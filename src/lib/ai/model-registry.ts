export type AiWorkflow =
  | "partner_briefing"
  | "segment_builder"
  | "message_drafting"
  | "payment_reconciliation"
  | "coordinator_brief";

export type AiToolRisk = "read" | "draft" | "mutation";

export const defaultModel = process.env.BENMP_DEFAULT_MODEL ?? "gateway:auto";

export const toolRiskByWorkflow: Record<AiWorkflow, AiToolRisk> = {
  partner_briefing: "read",
  segment_builder: "draft",
  message_drafting: "draft",
  payment_reconciliation: "draft",
  coordinator_brief: "read",
};

export function requiresHumanApproval(workflow: AiWorkflow) {
  return toolRiskByWorkflow[workflow] !== "read";
}
