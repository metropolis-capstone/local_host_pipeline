import axios from 'axios';
import type { Recommendation } from './recommendationGenerator.js';

type MetricType = 'counter' | 'gauge' | 'histogram' | 'summary';

const VMSELECT_METADATA_ENDPOINT = process.env.VMSELECT_METADATA_ENDPOINT
  || 'http://localhost:8481/select/0/prometheus/api/v1/metadata';

interface VMMetadataResponse { 
  status: 'success' | 'error';
  data: {
    [metricName: string]: Array<{ type: string }>;
  };
}

export async function detectMetricType(recommendation: Recommendation): Promise<MetricType> {
  const { metricName, remainingLabels, problemLabels } = recommendation;
  const allLabels = [...remainingLabels, ...problemLabels];

  // label-based checks are most reliable
  if (allLabels.includes('le')) return 'histogram';
  if (allLabels.includes('quantile')) return 'summary';

  // name suffix checks — [._] handles both Prometheus (underscore) and OTel (dot) naming
  if (/[._]total$/.test(metricName)) return 'counter';
  if (/[._](bucket|sum|count|created)$/.test(metricName)) return 'histogram';
  if (/[._]info$/.test(metricName)) return 'gauge';

  // fallback to VM metadata API
  try {
    const response = await axios.get<VMMetadataResponse>(VMSELECT_METADATA_ENDPOINT, {
      params: { metric: metricName },
    });
    const type = response.data?.data?.[metricName]?.[0]?.type;
    if (type === 'counter' || type === 'gauge' || type === 'histogram' || type === 'summary') {
      return type;
    }
  } catch {
    // API unreachable, fall through to default
  }

  // Needs more research here to determine the default. 
  // default to gauge** (subject to change)
  return 'gauge';
}

export async function buildYaml(_recommendation: Recommendation, type: MetricType): Promise<string> {
    const without = _recommendation.problemLabels.join(', ');

    const rule = (outputs: string) =>
        `- match: '${_recommendation.metricName}'\n  interval: 1m\n  outputs: [${outputs}]\n  without: [${without}]`;

    switch (type) {
    case "counter":
        // total accumulates the sum across the dropped label dimension
        return rule('total');
    case "gauge":
        // avg aggregates gauge values across the dropped label dimension
        return rule('avg');
    case "histogram":
        // histogram_bucket preserves the le-keyed bucket structure
        return rule('histogram_bucket');
    case "summary":
        // avg is a reasonable approximation when collapsing pre-computed quantiles
        return rule('avg');
    }
}


// take a recommendation confirmed by user
// parse recommendation type (to establish how to aggregate it)
    // try from name first with regex
    // fallback on vmselect metadata api endpoint
    // default to gauge** (subject to change)
// generate yaml string instruction to remove problem label
    // needs to also specify aggragation strat that is dependent on recommendation type
// return the string