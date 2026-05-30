import OpenAI from "openai";
import { getAiContext } from "./aiContext.js";

type InvestigationRequest = {
  question: string;
  date: string;
};

type InvestigationResult = {
  summary: string;
  evidence: string[];
  likelyCause: string;
  riskLevel: "low" | "medium" | "high";
  suggestedNextAction: string;
  toolCallsUsed: string[];
};

const MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";

const resultSchema = {
  type: "json_schema",
  name: "ai_investigation_result",
  strict: true,
  schema: {
    type: "object",
    properties: {
      summary: { type: "string" },
      evidence: { type: "array", items: { type: "string" } },
      likelyCause: { type: "string" },
      riskLevel: { type: "string", enum: ["low", "medium", "high"] },
      suggestedNextAction: { type: "string" },
      toolCallsUsed: { type: "array", items: { type: "string" } },
    },
    required: [
      "summary",
      "evidence",
      "likelyCause",
      "riskLevel",
      "suggestedNextAction",
      "toolCallsUsed",
    ],
    additionalProperties: false,
  },
} as const;

const toolDefinitions: any[] = [
  {
    type: "function",
    name: "getMetropolisAiContext",
    description: "Get read-only Metropolis recommendation context for a date.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        date: { type: "string", description: "Date in YYYY-MM-DD format." },
      },
      required: ["date"],
      additionalProperties: false,
    },
  },
];

export async function investigateCardinality(
  request: InvestigationRequest
): Promise<InvestigationResult> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required on the smart_metrics backend.");
  }

  const input: any[] = [
    {
      role: "user",
      content: `Question: ${request.question}\nDate: ${request.date}`,
    },
  ];

  const client = new OpenAI();
  const toolCallsUsed: string[] = [];

  for (let round = 0; round < 3; round += 1) {
    const response = await client.responses.create({
      model: MODEL,
      instructions: systemInstructions(),
      tools: toolDefinitions,
      input,
    });

    input.push(...response.output);
    const toolCalls = response.output.filter((item) => item.type === "function_call");
    if (!toolCalls.length) break;

    for (const item of toolCalls) {
      const args = JSON.parse(item.arguments || "{}");
      const context = await getAiContext(args.date ?? request.date);
      toolCallsUsed.push("getMetropolisAiContext");

      input.push({
        type: "function_call_output",
        call_id: item.call_id,
        output: JSON.stringify(context),
      });
    }
  }

  const finalResponse = await client.responses.create({
    model: MODEL,
    instructions: systemInstructions(),
    text: { format: resultSchema },
    input,
  });

  const parsed = JSON.parse(finalResponse.output_text) as InvestigationResult;
  return {
    ...parsed,
    toolCallsUsed: parsed.toolCallsUsed.length ? parsed.toolCallsUsed : toolCallsUsed,
  };
}

function systemInstructions() {
  return [
    "You are the Metropolis AI Cardinality Investigator.",
    "Call getMetropolisAiContext first for backend recommendation context.",
    "Use only the provided tool output as evidence.",
    "If the backend context has no recommendations, say there is not enough data yet.",
    "Do not claim YAML was applied.",
    "Do not accept, decline, apply, reload, delete, or mutate anything.",
  ].join("\n");
}

