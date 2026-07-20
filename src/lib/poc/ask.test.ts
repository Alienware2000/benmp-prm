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
      payments: [
        { reference: "TXN2", payerName: "Kwesi Stranger", payerPhone: "+233209999999", amountMinor: 7550, currency: "GHS", paidAt: "2026-07-10" },
      ],
      totalMinor: 7550,
      phone: "+233209999999",
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

  it("falls back to the deterministic answer when the model throws (demo resilience)", async () => {
    const model: PocModelClient = {
      generate: vi.fn(async () => {
        throw new Error("gemini 503");
      }),
    };
    const ans = await askAi("How much did we collect?", result, { model });
    expect(ans).toContain("225.50"); // grounded fallback, not an error
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

describe("answers stay concise with many unregistered givers (no name dumps)", () => {
  // 120 unregistered payers — the real-data shape that produced overwhelming answers
  const many: ReconciliationResult = {
    registeredPaid: [],
    registeredUnpaid: [],
    statementRows: [],
    paidUnregistered: Array.from({ length: 120 }, (_, i) => ({
      payments: [
        { reference: `TX${i}`, payerName: `Giver ${i}`, payerPhone: `+23320${String(1000000 + i)}`, amountMinor: 1000 + i, currency: "GHS", paidAt: "2026-07-01" },
      ],
      totalMinor: 1000 + i,
      phone: `+23320${String(1000000 + i)}`,
      suggestedName: `Giver ${i}`,
      includeAndMessage: true as const,
    })),
  };

  it("grounding caps the examples and instructs count-first style", () => {
    const g = buildGrounding(headlineAnswers(many));
    const nameCount = (g.match(/Giver \d+/g) ?? []).length;
    expect(nameCount).toBeLessThanOrEqual(5);
    expect(g).toContain("…and 115 more");
    expect(g).toMatch(/lead with the number/i);
    expect(g).toMatch(/never enumerate/i);
  });

  it("deterministic answer gives the count, top examples, and points to the table", () => {
    const ans = answerLocally("Who paid but isn't on the register?", headlineAnswers(many));
    expect(ans).toContain("120");
    const nameCount = (ans.match(/Giver \d+/g) ?? []).length;
    expect(nameCount).toBeLessThanOrEqual(5);
    expect(ans).toMatch(/partners table/i);
    // largest gifts are the examples shown
    expect(ans).toContain("Giver 119");
  });
});
