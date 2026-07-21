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
    expect(summarizePlan(many, { sampleSize: 3 }).sample).toHaveLength(3);
  });

  it("counts opted-out recipients separately and removes them from sendable", () => {
    const s = summarizePlan(
      [msg({ to: "+233244123456" }), msg({ to: "+233209999999" }), msg({ to: null, sendable: false })],
      { optedOut: new Set(["+233209999999"]) },
    );
    expect(s.sendable).toBe(1);
    expect(s.optedOut).toBe(1);
    expect(s.skippedNoPhone).toBe(1);
  });

  it("handles an empty plan", () => {
    const s = summarizePlan([]);
    expect(s).toMatchObject({ total: 0, sendable: 0, skippedNoPhone: 0, optedOut: 0, thankYou: 0, reminder: 0, direct: 0 });
    expect(s.sample).toEqual([]);
  });
});

import { filterByKind } from "./dispatch";

describe("filterByKind", () => {
  const plan = [
    msg({ kind: "thank_you", partnerRef: "a" }),
    msg({ kind: "reminder", partnerRef: "b" }),
    msg({ kind: "reminder", partnerRef: "c" }),
  ];
  it("returns everything for 'all'", () => {
    expect(filterByKind(plan, "all")).toHaveLength(3);
  });
  it("filters to one queue", () => {
    expect(filterByKind(plan, "thank_you").map((m) => m.partnerRef)).toEqual(["a"]);
    expect(filterByKind(plan, "reminder")).toHaveLength(2);
  });
});

describe("summarizePlan — directory messages", () => {
  it("counts direct messages as their own kind, not as reminders", () => {
    const s = summarizePlan([
      msg({ kind: "direct" }),
      msg({ kind: "direct" }),
      msg({ kind: "reminder" }),
    ]);
    expect(s.direct).toBe(2);
    expect(s.reminder).toBe(1);
    expect(s.thankYou).toBe(0);
  });
});
