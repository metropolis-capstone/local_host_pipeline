import { collectQueries, collectDashboardQueries } from './grafanaApiInterface.js';
import type { QueryHistoryEntry } from './grafanaApiInterface.js';
import { getMetricsData, getLabelValueCountsForMetric } from './vmSelectApiInterface.js';
import type { TSDBDataItem } from './vmSelectApiInterface.js';
import { parsePromqlExpression } from './promQLQueryParser.js';

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

export async function grafanaQueriesParser() {
  const queryHistory = await collectQueries()
  const grafanaQueriesObject: Record<string, Set<string>> = {}
  queryHistory.forEach((queryHistoryEntry: QueryHistoryEntry) => {
    const query = queryHistoryEntry.queries[0]?.expr;
    if (!query) { return }
    const { metrics, labels } = parsePromqlExpression(query);

    metrics.forEach((metricName: string) => {
      grafanaQueriesObject[metricName] ??= new Set();
      const set = grafanaQueriesObject[metricName];
      if (!isDefined(set)) { return }
      labels.forEach(label => set.add(label));
    })
  })
  return grafanaQueriesObject;
}

export async function grafanaDashboardQueriesParser() {
  const dashboardQueries = await collectDashboardQueries()
  const grafanaQueriesObj: Record<string, Set<string>> = {}

  dashboardQueries.forEach((query: string) => {
    const { metrics, labels } = parsePromqlExpression(query);
    metrics.forEach((metricName: string) => {
      grafanaQueriesObj[metricName] ??= new Set();
      const set = grafanaQueriesObj[metricName];
      if (!isDefined(set)) { return }
      labels.forEach(label => set.add(label));
    })
  })
  return grafanaQueriesObj;
}

export function combineManualandDashboardQueries(
  grafanaQueriesObj: Record<string, Set<string>>,
  grafanaDashboardQueriesObj: Record<string, Set<string>>
): Record<string, Set<string>> {
  const combined: Record<string, Set<string>> = {};

  for (const [metric, labels] of Object.entries(grafanaQueriesObj)) {
    combined[metric] = new Set(labels);
  }

  for (const [metric, labels] of Object.entries(grafanaDashboardQueriesObj)) {
    combined[metric] ??= new Set();
    const set = combined[metric];
    if (!isDefined(set)) { throw new Error("combineManualAndDashboardQueries tried to iterate over undefined") };
    labels.forEach(label => set.add(label));
  }

  return combined;
}

type LabelValueCount = TSDBDataItem;

interface MetricLabelsMap {
  [metricName: string]: LabelValueCount[];
}

// returns metrics data for a given day.
export async function vmParser(date: Date) {
  const metricsData = await getMetricsData(date);
  const vmObject: MetricLabelsMap = {};
  const { seriesCountByMetricName } = metricsData;

  await Promise.all(
    seriesCountByMetricName.map(async metric => {
      const { labelValueCountByLabelName } = await getLabelValueCountsForMetric(metric.name, date);
      
      vmObject[metric.name] = labelValueCountByLabelName;
    })
  )
  return vmObject
}

// example use for today's (utc timezone) data:
// vmParser(new Date).then(console.log)

// determining those labels that are never queried
export function determineUnqueriedMetricLabels(grafanaQueriesObj: Record<string, Set<string>>, vmObject: MetricLabelsMap) {
  const output: typeof vmObject = {}

  for (let metric in vmObject) {
    output[metric] = []
    const queriedLabels = grafanaQueriesObj[metric] ?? new Set();
    const labelObjsForMetric = vmObject[metric] as LabelValueCount[];
    labelObjsForMetric.forEach(labelObj => {
      if (!queriedLabels.has(labelObj.name) && output[metric]) {
        output[metric].push(labelObj);
      }
    })
  }
  return output;
}

// example use
// const grafanaQueriesObj = await grafanaQueriesParser();
// const grafanaDashboardQueriesObj = await grafanaDashboardQueriesParser();
// const allGrafanaQueriesObj = combineManualandDashboardQueries(grafanaQueriesObj, grafanaDashboardQueriesObj);
// const vmObj = await vmParser(new Date);
// const unusued_labels = determineUnqueriedMetricLabels(allGrafanaQueriesObj, vmObj);
// console.log(unusued_labels)