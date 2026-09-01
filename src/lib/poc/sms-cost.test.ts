import { describe, expect, it } from "vitest";
import { isUnicodeSms, smsCost, smsParts } from "./sms-cost";

const chars = (n: number) => "x".repeat(n);
const EMOJI = String.fromCodePoint(0x1f600);

describe("smsParts", () => {
  // Boundaries verified against FlashSMS /sms/estimate on 2026-09-01.
  it("matches the provider at every part boundary", () => {
    expect(smsParts(chars(159))).toBe(1);
    expect(smsParts(chars(160))).toBe(1);
    expect(smsParts(chars(161))).toBe(2);
    expect(smsParts(chars(305))).toBe(2);
    expect(smsParts(chars(306))).toBe(2);
    expect(smsParts(chars(307))).toBe(3);
    expect(smsParts(chars(459))).toBe(3);
  });

  it("costs the two real campaign drafts correctly", () => {
    expect(smsParts(chars(881))).toBe(6); // the original notice
    expect(smsParts(chars(274))).toBe(2); // the reframed one
  });

  it("is 0 for an empty body, not 1", () => {
    expect(smsParts("")).toBe(0);
  });

  it("drops to the Unicode limit when one non-GSM character sneaks in", () => {
    // A single emoji turns a one-part message into three.
    expect(smsParts(chars(160))).toBe(1);
    expect(smsParts(chars(159) + EMOJI)).toBe(3);
  });
});

describe("isUnicodeSms", () => {
  it("passes ordinary office text", () => {
    expect(isUnicodeSms("Dear Partner, God bless you. BENMP OFFICE")).toBe(
      false,
    );
  });

  it("catches an emoji", () => {
    expect(isUnicodeSms("thanks " + EMOJI)).toBe(true);
  });
});

describe("smsCost", () => {
  it("multiplies parts by recipients", () => {
    const cost = smsCost(chars(274), 10_843);
    expect(cost.parts).toBe(2);
    expect(cost.creditsPerRecipient).toBe(2);
    expect(cost.creditsTotal).toBe(21_686);
  });

  it("shows the 43,000-credit gap between the two campaign drafts", () => {
    // This is the whole reason the composer shows cost before the send button.
    expect(smsCost(chars(881), 10_843).creditsTotal).toBe(65_058);
    expect(smsCost(chars(274), 10_843).creditsTotal).toBe(21_686);
  });

  it("reports headroom before the next part — the cliff staff cannot see", () => {
    expect(smsCost(chars(150), 1).charactersUntilNextPart).toBe(10);
    expect(smsCost(chars(160), 1).charactersUntilNextPart).toBe(0);
    expect(smsCost(chars(274), 1).charactersUntilNextPart).toBe(32);
  });

  it("flags Unicode so staff can see why the cost jumped", () => {
    expect(smsCost("hello", 1).unicode).toBe(false);
    expect(smsCost("hello " + EMOJI, 1).unicode).toBe(true);
  });

  it("costs nothing for an empty body", () => {
    expect(smsCost("", 500).creditsTotal).toBe(0);
  });
});
