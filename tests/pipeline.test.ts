import axios from 'axios';

// polls vmselect every 500ms until the metric appears at the given query time, or the timeout elapses.
// queryTimeSeconds is the unix timestamp (seconds) we want vmselect to anchor its 5-minute lookback to.
// passing it explicitly avoids relying on vmselect's "now" matching the timestamp vminsert stored.
async function pollForMetric(
  metricName: string,
  queryTimeSeconds: number,
  timeoutMs = 30000
): Promise<number> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await axios.get(
        // /select/0/prometheus — the 0 is the tenant id; we're using the default single-tenant setup
        'http://localhost:8481/select/0/prometheus/api/v1/query',
        // time anchors the lookback window so the query covers the timestamp we stored the metric at
        { params: { query: metricName, time: queryTimeSeconds } }
      );
      const results: any[] = res.data?.data?.result ?? [];
      // result[i].value is [unixTimestamp, stringValue] — vmselect returns values as strings
      if (results.length > 0) return parseFloat(results[0].value[1]);
    } catch {
      // not yet visible; keep polling
    }
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error(`${metricName} not queryable after ${timeoutMs}ms`);
}

describe('pipeline', () => {
  test('metric written to vmagent is queryable via vmselect', async () => {
    // timestamp suffix makes the name unique per run so leftover data from a failed teardown can't cause a false positive
    const metricName = `test_metric_${Date.now()}`;
    const timestampMs = Date.now();

    // include the timestamp explicitly in the payload so we control what's stored
    // and can pass the same timestamp to the query — avoids relying on vminsert/vmselect clock alignment
    await axios.post(
      // vmagent accepts prometheus text exposition format: "<name> <value> <timestamp_ms>\n"
      'http://localhost:8429/api/v1/import/prometheus',
      `${metricName} 42 ${timestampMs}\n`,
      { headers: { 'Content-Type': 'text/plain' } }
    );

    // query at the insertion timestamp + 60s so the 5-minute lookback window definitely covers it
    const actual = await pollForMetric(metricName, Math.floor(timestampMs / 1000) + 60);
    expect(actual).toBeCloseTo(42);

  // must exceed the 30s poll timeout — jest kills the test at this threshold, not the poller
  }, 45000);
});
