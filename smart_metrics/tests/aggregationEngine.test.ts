import { vi, test, expect, beforeEach } from 'vitest'
import { databaseParser, queryParser, determineUnqueriedMetricLabels } from '../src/aggregationEngine.js'
import getMetricsDataTestData from './getMetricsDataTestData.json' with { type: 'json' }
import getLabelValueCountsForMetricTestData from './getLabelValueCountsForMetricTestData.json' with { type: 'json' }
import collectQueriesTestData from './collectQueriesTestData.json' with { type: 'json' }

// Safe defaults are required here because aggregationEngine.ts has top-level awaits
// that fire the moment the module is imported — before beforeEach can set return values.
const { mockGetMetricsData, mockGetLabelValueCountsForMetric, mockCollectQueries } = vi.hoisted(() => ({
  mockGetMetricsData: vi.fn().mockResolvedValue({ seriesCountByMetricName: [] }),
  mockGetLabelValueCountsForMetric: vi.fn().mockResolvedValue({ labelValueCountByLabelName: [] }),
  mockCollectQueries: vi.fn().mockResolvedValue([]),
}))

vi.mock('../src/vmSelectApiInterface.js', () => ({
  getMetricsData: mockGetMetricsData,
  getLabelValueCountsForMetric: mockGetLabelValueCountsForMetric,
}))

vi.mock('../src/grafanaApiInterface.js', () => ({
  collectQueries: mockCollectQueries,
}))

const testDate = new Date('2026-05-19')
const expectedMetricNames = getMetricsDataTestData.data.seriesCountByMetricName.map(m => m.name)
const expectedLabelCounts = getLabelValueCountsForMetricTestData.data.labelValueCountByLabelName

beforeEach(() => {
  vi.clearAllMocks()
  mockGetMetricsData.mockResolvedValue(getMetricsDataTestData.data)
  mockGetLabelValueCountsForMetric.mockResolvedValue(getLabelValueCountsForMetricTestData.data)
  mockCollectQueries.mockResolvedValue(collectQueriesTestData.result.queryHistory)
})

// queryParser tests

test('queryParser returns an object with exactly the queried metric names as keys', async () => {
  const result = await queryParser()
  expect(Object.keys(result).sort()).toEqual(['http.active_connections', 'http.requests.total'])
})

test('queryParser maps http.requests.total to all labels it has been queried with', async () => {
  const result = await queryParser()
  expect(result['http.requests.total']).toEqual(['method'])
})

test('queryParser maps http.active_connections to all labels it has been queried with', async () => {
  const result = await queryParser()
  expect(result['http.active_connections']).toEqual(['scope.name'])
})

test('queryParser calls collectQueries exactly once', async () => {
  await queryParser()
  expect(mockCollectQueries).toHaveBeenCalledTimes(1)
})

// databaseParser tests

test('returns an object keyed by all metric names from getMetricsData', async () => {
  const result = await databaseParser(testDate)
  expect(Object.keys(result).sort()).toEqual(expectedMetricNames.slice().sort())
})

test('http.requests.total in the databaseParser() object, maps to the correct labelValueCountByLabelName value', async () => {
  const result = await databaseParser(testDate)
  expect(result['http.requests.total']).toEqual(expectedLabelCounts)
})

test('getLabelValueCountsForMetric is called once per metric', async () => {
  await databaseParser(testDate)
  expect(mockGetLabelValueCountsForMetric).toHaveBeenCalledTimes(expectedMetricNames.length)
})

test('getLabelValueCountsForMetric is called with the correct metric name and date for each metric', async () => {
  await databaseParser(testDate)
  for (const metricName of expectedMetricNames) {
    expect(mockGetLabelValueCountsForMetric).toHaveBeenCalledWith(metricName, testDate)
  }
})

// determineUnqueriedMetricLabels tests

test('queried labels are excluded from the output', () => {
  const grafanaQueriesObj = { 'http.requests.total': ['method'] }
  const vmObject = { 'http.requests.total': getLabelValueCountsForMetricTestData.data.labelValueCountByLabelName }
  const result = determineUnqueriedMetricLabels(grafanaQueriesObj, vmObject)
  const expected = getLabelValueCountsForMetricTestData.data.labelValueCountByLabelName.filter(l => l.name !== 'method')
  expect(result['http.requests.total']).toEqual(expected)
})

test('a metric absent from grafanaQueriesObj retains all its labels', () => {
  const grafanaQueriesObj = {}
  const vmObject = { 'http.requests.total': getLabelValueCountsForMetricTestData.data.labelValueCountByLabelName }
  const result = determineUnqueriedMetricLabels(grafanaQueriesObj, vmObject)
  expect(result['http.requests.total']).toEqual(getLabelValueCountsForMetricTestData.data.labelValueCountByLabelName)
})

test('a metric whose every label was queried maps to an empty array', () => {
  const grafanaQueriesObj = { 'some.metric': ['label_a', 'label_b'] }
  const vmObject = { 'some.metric': [{ name: 'label_a', value: 10 }, { name: 'label_b', value: 5 }] }
  const result = determineUnqueriedMetricLabels(grafanaQueriesObj, vmObject)
  expect(result['some.metric']).toEqual([])
})

test('output has a key for every metric in vmObject', () => {
  const grafanaQueriesObj = { 'http.requests.total': ['method'] }
  const vmObject = {
    'http.requests.total': getLabelValueCountsForMetricTestData.data.labelValueCountByLabelName,
    'http.active_connections': [{ name: 'scope.name', value: 1 }, { name: '__name__', value: 1 }],
  }
  const result = determineUnqueriedMetricLabels(grafanaQueriesObj, vmObject)
  expect(Object.keys(result).sort()).toEqual(['http.active_connections', 'http.requests.total'])
})
