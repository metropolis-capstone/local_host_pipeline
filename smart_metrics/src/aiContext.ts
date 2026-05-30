import { pool } from "./database.js";

type RecommendationStatus = "pending" | "accepted" | "declined";

type RecommendationRow = {
  id: string;
  metric_name: string;
  status: RecommendationStatus;
  problem_label: string;
  remaining_labels: string[];
  estimated_current_series: string;
  estimated_after_series: string;
  estimated_reduction_percent: string;
  explanation: string;
  decision_reason: string | null;
  yaml_content: string | null;
  created_at: Date;
  decided_at: Date | null;
};

function formatRecommendation(row: RecommendationRow) {
  return {
    id: Number(row.id),
    metricName: row.metric_name,
    status: row.status,
    problemLabel: row.problem_label,
    remainingLabels: row.remaining_labels,
    estimatedCurrentSeries: Number(row.estimated_current_series),
    estimatedAfterSeries: Number(row.estimated_after_series),
    estimatedReductionPercent: Number(row.estimated_reduction_percent),
    explanation: row.explanation,
    decisionReason: row.decision_reason,
    yamlContent: row.yaml_content,
    createdAt: row.created_at.toISOString(),
    decidedAt: row.decided_at?.toISOString() ?? null,
  };
}

export async function getAiContext(date: string) {
  const pendingResult = await pool.query<RecommendationRow>(
    `SELECT * FROM recommendations WHERE status = 'pending' ORDER BY created_at DESC`
  );

  const recentDecisionResult = await pool.query<RecommendationRow>(
    `SELECT * FROM recommendations
     WHERE status IN ('accepted', 'declined')
     ORDER BY decided_at DESC
     LIMIT 10`
  );

  const statusCountResult = await pool.query<{ status: RecommendationStatus; count: string }>(
    `SELECT status, COUNT(*) FROM recommendations GROUP BY status`
  );

  const statusCounts = new Map(
    statusCountResult.rows.map((row) => [row.status, Number(row.count)])
  );

  const highestReductionRow = pendingResult.rows.reduce<RecommendationRow | null>(
    (highest, current) => {
      if (!highest) return current;

      return Number(current.estimated_reduction_percent) >
        Number(highest.estimated_reduction_percent)
        ? current
        : highest;
    },
    null
  );
  const highestReductionRecommendation = highestReductionRow
    ? formatRecommendation(highestReductionRow)
    : null;

  return {
    date,
    generatedAt: new Date().toISOString(),
    summary: {
      pendingRecommendationCount: statusCounts.get("pending") ?? 0,
      acceptedRecommendationCount: statusCounts.get("accepted") ?? 0,
      declinedRecommendationCount: statusCounts.get("declined") ?? 0,
      highestReductionRecommendation: highestReductionRecommendation
        ? {
            id: highestReductionRecommendation.id,
            metricName: highestReductionRecommendation.metricName,
            problemLabel: highestReductionRecommendation.problemLabel,
            estimatedReductionPercent:
              highestReductionRecommendation.estimatedReductionPercent,
          }
        : null,
    },
    pendingRecommendations: pendingResult.rows.map(formatRecommendation),
    recentDecisions: recentDecisionResult.rows.map(formatRecommendation),
  };
}

