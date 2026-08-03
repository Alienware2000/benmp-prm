export type AiWorkflow =
  | "partner_briefing"
  | "segment_builder"
  | "message_drafting"
  | "payment_reconciliation"
  | "coordinator_brief"
  | "poc_answers";

export type AiToolRisk = "read" | "draft" | "mutation";

export const defaultModel = process.env.BENMP_DEFAULT_MODEL ?? "gateway:auto";

/** Stable low-latency default. The provider/model remains environment-configurable. */
export const POC_MODEL = "gemini-3.6-flash";

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
