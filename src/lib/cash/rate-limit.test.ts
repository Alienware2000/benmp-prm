import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { checkRateLimit } from "./rate-limit";

describe("checkRateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-06T12:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows requests under the limit", () => {
    const limiter = new Map();
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit(limiter, "1.2.3.4", 5, 15 * 60 * 1000)).toBe(true);
    }
  });
  it("blocks the 6th request within the window", () => {
    const limiter = new Map();
    for (let i = 0; i < 5; i++) {
      checkRateLimit(limiter, "1.2.3.4", 5, 15 * 60 * 1000);
    }
    expect(checkRateLimit(limiter, "1.2.3.4", 5, 15 * 60 * 1000)).toBe(false);
  });
  it("allows again after the window passes", () => {
    const limiter = new Map();
    for (let i = 0; i < 5; i++) {
      checkRateLimit(limiter, "1.2.3.4", 5, 15 * 60 * 1000);
    }
    vi.advanceTimersByTime(16 * 60 * 1000);
    expect(checkRateLimit(limiter, "1.2.3.4", 5, 15 * 60 * 1000)).toBe(true);
  });
  it("tracks IPs independently", () => {
    const limiter = new Map();
    for (let i = 0; i < 5; i++) {
      checkRateLimit(limiter, "1.2.3.4", 5, 15 * 60 * 1000);
    }
    expect(checkRateLimit(limiter, "5.6.7.8", 5, 15 * 60 * 1000)).toBe(true);
  });
});