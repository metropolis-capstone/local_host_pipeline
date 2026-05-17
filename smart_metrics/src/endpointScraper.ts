import axios from "axios";
import dotenv from "dotenv";

dotenv.config();
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
  const endDate = new Date();
  const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const endIso = endDate.toISOString();
  const startIso = startDate.toISOString();

  const res = await axios.get<HistoricalAPIResponse>(`${vmSelectEndpoint}/label/__name__/values?start=${startIso}&end=${endIso}`);
  return res.data.data;
}

