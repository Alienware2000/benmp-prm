export type AiWorkflow =
  | "partner_briefing"
  | "segment_builder"
  | "message_drafting"
  | "payment_reconciliation"
  | "coordinator_brief"
  | "poc_answers";

export type AiToolRisk = "read" | "draft" | "mutation";

export const defaultModel = process.env.BENMP_DEFAULT_MODEL ?? "gateway:auto";

/**
 * POC model: Gemini 2.5 on the fresh GCP Vertex account (Decision 0008 — Claude on
 * Vertex isn't available immediately on a new project, and the POC shouldn't wait).
 * Resolved from env so it can be overridden without a code change.
 */
export const POC_MODEL = "gemini-2.5";

export function pocModelId(): string {
  return process.env.BENMP_POC_MODEL ?? POC_MODEL;
}

export const toolRiskByWorkflow: Record<AiWorkflow, AiToolRisk> = {
  partner_briefing: "read",
  segment_builder: "draft",
  message_drafting: "draft",
  payment_reconciliation: "draft",
  coordinator_brief: "read",
  poc_answers: "read", // the POC assistant is strictly read-only
};

export function requiresHumanApproval(workflow: AiWorkflow) {
  return toolRiskByWorkflow[workflow] !== "read";
}
