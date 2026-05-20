import { collectQueries, collectDashboardQueries } from './grafanaApiInterface.js';
import type { QueryHistoryEntry, QueryDefinition } from './grafanaApiInterface.js';
import { getMetricsData, getLabelValueCountsForMetric } from './vmSelectApiInterface.js';
import type { MetricsData } from './vmSelectApiInterface.js';
import { parsePromqlExpression } from './promQLQueryParser.js';
import { MetricName } from '@prometheus-io/lezer-promql';

export async function grafanaQueriesParser() {
  const queryHistory = await collectQueries() as QueryHistoryEntry[]
  const grafanaQueriesObject: Record<string, Set<string>> = {}
  queryHistory.forEach((queryHistoryEntry: QueryHistoryEntry) => {
    const query: string = queryHistoryEntry.queries[0].expr as string
    const { metrics, labels } = parsePromqlExpression(query);

    metrics.forEach((metricName: string) => {
      grafanaQueriesObject[metricName] ??= new Set();
      labels.forEach(label => grafanaQueriesObject[metricName].add(label));
    })
  })
  return grafanaQueriesObject;
}

export async function grafanaDashboardQueriesParser() {
  const dashboardQueries = await collectDashboardQueries() as string[]
  const grafanaQueriesObj: Record<string, Set<string>> = {}

  dashboardQueries.forEach((query: string) => {
    const { metrics, labels } = parsePromqlExpression(query);
    metrics.forEach((metricName: string) => {
      grafanaQueriesObj[metricName] ??= new Set();
      labels.forEach(label => grafanaQueriesObj[metricName].add(label));
    })
  })
  return grafanaQueriesObj;
}

grafanaQueriesParser().then(console.log)
grafanaDashboardQueriesParser().then(console.log)

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
      labels.forEach(label => combined[metric].add(label));
    }

    return combined;
  }

interface LabelValueCount {
  name: string;
  value: number;
}

interface MetricLabelsMap {
  [metricName: string]: LabelValueCount[];
}

export async function vmParser(date: Date) {

  const metricsData = await getMetricsData(date);
  const vmObject: MetricLabelsMap = {};
  const { seriesCountByMetricName } = metricsData;

  await Promise.all(
    seriesCountByMetricName.map(async metric => {
      const { labelValueCountByLabelName } = await getLabelValueCountsForMetric(metric.name, date);
      
      // resolve this type later
      vmObject[metric.name] = labelValueCountByLabelName as any;
    })
  )
  return vmObject
}

//vmParser(new Date).then(console.log)
//grafanaQueriesParser().then(console.log)

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