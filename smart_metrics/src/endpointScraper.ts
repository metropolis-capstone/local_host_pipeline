import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

//tenant id here is 0 since that seems to always work
//read about tenant id
const vmSelectEndpoint = process.env.VMSELECT_ENDPOINT || "http://localhost:8481/select/0/prometheus/api/v1"

//this is in case victoria metrics was taken offline and brought online again
//because the series won't be in memory so we have to do some manual api
//scraping to get the data we need
interface HistoricalAPIResponse {
  status: string;
  isPartial: boolean;
  data: string[];
}

const getAllHistoricalMetricNames = async () => {
  //db will only have max 1 month's worth of data
  const endDate = new Date();
  const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  //need iso strings for vmselect url parameters
  const endIso = endDate.toISOString();
  const startIso = startDate.toISOString();

  const res = await axios.get<HistoricalAPIResponse>(`${vmSelectEndpoint}/label/__name__/values?start=${startIso}&end=${endIso}`);
  return res.data.data;
}

interface MetricsAPIResponse {
  status: string;
  isPartial: boolean;
  data: MetricsData;
}

interface MetricsData {
  totalSeries: number;
  totalLabelValuePairs: number;
  seriesCountByMetricName: MetricCount[];
  seriesCountByLabelName: LabelCount[];
  seriesCountByFocusLabelValue: LabelValuePairCount[];
  seriesCountByLabelValuePair: LabelValuePairCount[];
  labelValueCountByLabelName: LabelCount[];
}

interface LabelCount {
  name: string;
  value: number;
}

interface MetricCount extends LabelCount {
  requestsCount: number;
  lastRequestTimestamp: number;
}

interface LabelValuePairCount extends LabelCount {}

// we are interested in seriesCountByMetricName and labelValueCountByLabelName
// use like this:
// const { seriesCountByMetricName } = await getCurrentActiveMetrics();
// also gives label value counts but we have no idea which metrics they're associated with
const getMetricsData = async (date?: Date) => {
  // this gives utc date; can be off by 1 for certain timezones at certain times
  // for example when i tested it I had to use today's date to get yesterday's results.
  const targetDay = date && date.toISOString().slice(0, 10);
  const endpoint = targetDay ? `${vmSelectEndpoint}//status/tsdb?topN=100&date=${targetDay}`
    : `${vmSelectEndpoint}//status/tsdb?topN=100`;
  const res = await axios.get<MetricsAPIResponse>(endpoint);
  return res.data.data;
}

// this is how we understand which labels are associated with which metrics
// note, there can and often is overlap
// use just like the above function
const getLabelValueCountsForMetric = async (metricName: string) => {
  const res = await axios.get<MetricsAPIResponse>(`${vmSelectEndpoint}//status/tsdb?match[]=${metricName}&topN=100`);
  return res.data.data;
}
