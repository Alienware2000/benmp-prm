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

describe("model registry — POC (Gemini 2.5, read-only)", () => {
  it("defaults the POC model to Gemini 2.5, overridable via env", () => {
    expect(pocModelId()).toBe(POC_MODEL);
    expect(POC_MODEL).toBe("gemini-2.5-flash");
    process.env.BENMP_POC_MODEL = "gemini-2.5-pro";
    expect(pocModelId()).toBe("gemini-2.5-pro");
  });

  it("keeps the POC assistant strictly read-only (no human approval needed)", () => {
    expect(toolRiskByWorkflow.poc_answers).toBe("read");
    expect(requiresHumanApproval("poc_answers")).toBe(false);
  });
});
