import { describe, it, expect, vi } from "vitest";
import { askAi, answerLocally, buildGrounding, type PocModelClient } from "./ask";
import { headlineAnswers } from "./answers";
import type { ReconciliationResult } from "../reconcile";

const result: ReconciliationResult = {
  registeredPaid: [
    { registration: { id: "reg_0", fullName: "Kofi", phone: "+233244000001" }, payments: [], totalMinor: 5000 },
    { registration: { id: "reg_1", fullName: "Ama", phone: "+233244000002" }, payments: [], totalMinor: 10000 },
  ],
  paidUnregistered: [
    {
      payment: { reference: "TXN2", payerName: "Kwesi Stranger", payerPhone: "+233209999999", amountMinor: 7550, currency: "GHS", paidAt: "2026-07-10" },
      suggestedName: "Kwesi Stranger",
      includeAndMessage: true,
    },
  ],
  registeredUnpaid: [
    { id: "reg_5", fullName: "Late One", phone: "+233244555000" },
    { id: "reg_6", fullName: "Late Two", phone: "+233244555001" },
  ],
  statementRows: [],
};

describe("answerLocally (deterministic, no model)", () => {
  const a = headlineAnswers(result);

  it("answers 'who paid'", async () => {
    expect(answerLocally("Who paid this month?", a)).toContain("3");
  });
  it("answers 'who hasn't paid'", () => {
    const ans = answerLocally("Who hasn't paid yet?", a);
    expect(ans).toContain("2");
    expect(ans.toLowerCase()).toContain("not paid");
  });
  it("answers 'who paid but isn't registered' with the names (Bishop Ebo)", () => {
    const ans = answerLocally("Who paid but isn't on the register?", a);
    expect(ans).toContain("1");
    expect(ans).toContain("Kwesi Stranger");
  });
  it("answers 'how much did we collect'", () => {
    expect(answerLocally("How much did we collect?", a)).toContain("225.50");
  });
});

describe("askAi", () => {
  it("uses the deterministic answer when no model is provided", async () => {
    const ans = await askAi("How much did we collect?", result);
    expect(ans).toContain("225.50");
  });

  it("delegates phrasing to the model, grounding the prompt with the real figures", async () => {
    const model: PocModelClient = {
      generate: vi.fn(async () => "We collected two hundred twenty-five cedis fifty."),
    };
    const ans = await askAi("How much did we collect?", result, { model });
    expect(ans).toBe("We collected two hundred twenty-five cedis fifty.");
    // the model must be grounded in the computed figures, not left to invent them
    const prompt = (model.generate as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(prompt).toContain("225.50");
    expect(prompt).toContain("Question: How much did we collect?");
  });
});

describe("buildGrounding", () => {
  it("states the four headline figures", () => {
    const g = buildGrounding(headlineAnswers(result));
    expect(g).toContain("225.50"); // total
    expect(g).toMatch(/paid/i);
    expect(g).toMatch(/unregistered/i);
  });
});
