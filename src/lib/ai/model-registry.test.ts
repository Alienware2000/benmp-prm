import { describe, it, expect, afterEach } from "vitest";
import {
  pocModelId,
  POC_MODEL,
  requiresHumanApproval,
  toolRiskByWorkflow,
} from "./model-registry";

afterEach(() => {
  delete process.env.BENMP_POC_MODEL;
});

describe("model registry - POC assistant", () => {
  it("defaults to a stable Flash model and remains overridable via env", () => {
    expect(pocModelId()).toBe(POC_MODEL);
    expect(POC_MODEL).toBe("gemini-3.6-flash");
    process.env.BENMP_POC_MODEL = "gemini-flash-latest";
    expect(pocModelId()).toBe("gemini-flash-latest");
  });

  it("keeps the POC assistant strictly read-only (no human approval needed)", () => {
    expect(toolRiskByWorkflow.poc_answers).toBe("read");
    expect(requiresHumanApproval("poc_answers")).toBe(false);
  });
});
