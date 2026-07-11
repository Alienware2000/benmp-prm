import { describe, it, expect } from "vitest";
import { summarizePlan } from "./dispatch";
import type { PlannedMessage } from "../messages";

const msg = (over: Partial<PlannedMessage>): PlannedMessage => ({
  kind: "thank_you",
  to: "+233244123456",
  name: "Ama",
  body: "Thank you Ama.",
  partnerRef: "p1",
  channel: "whatsapp",
  category: "utility",
  sendable: true,
  ...over,
});

describe("summarizePlan", () => {
  it("counts sendable vs skipped and by kind", () => {
    const s = summarizePlan([
      msg({ kind: "thank_you" }),
      msg({ kind: "thank_you" }),
      msg({ kind: "reminder" }),
      msg({ kind: "reminder", to: null, sendable: false }),
    ]);
    expect(s.total).toBe(4);
    expect(s.sendable).toBe(3);
    expect(s.skippedNoPhone).toBe(1);
    expect(s.thankYou).toBe(2);
    expect(s.reminder).toBe(2);
  });

  it("returns at most sampleSize examples", () => {
    const many = Array.from({ length: 20 }, (_, i) => msg({ partnerRef: `p${i}` }));
    expect(summarizePlan(many, 3).sample).toHaveLength(3);
  });

  it("handles an empty plan", () => {
    const s = summarizePlan([]);
    expect(s).toMatchObject({ total: 0, sendable: 0, skippedNoPhone: 0, thankYou: 0, reminder: 0 });
    expect(s.sample).toEqual([]);
  });
});
