import { describe, it, expect, vi, afterEach } from "vitest";
import fc from "fast-check";
import { FreshnessState, getFreshnessState, getRelativeTime } from "../utils";

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;
const FIXED_NOW = new Date("2025-06-01T12:00:00.000Z").getTime();

describe("Property 10: Freshness classification is correct", () => {
  afterEach(() => { vi.useRealTimers(); });

  const freshElapsedArb = fc.integer({ min: 0, max: MS_PER_HOUR - 1 });
  const staleElapsedArb = fc.integer({ min: MS_PER_HOUR, max: MS_PER_DAY - 1 });
  const oldElapsedArb = fc.integer({ min: MS_PER_DAY, max: 30 * MS_PER_DAY });

  function toIso(elapsedMs: number): string {
    return new Date(FIXED_NOW - elapsedMs).toISOString();
  }

  it("classifies timestamps < 1 hour ago as Fresh", () => {
    vi.useFakeTimers({ now: FIXED_NOW });
    fc.assert(fc.property(freshElapsedArb, (elapsed) => {
      expect(getFreshnessState(toIso(elapsed))).toBe(FreshnessState.Fresh);
    }), { numRuns: 100 });
  });

  it("classifies timestamps 1–24 hours ago as Stale", () => {
    vi.useFakeTimers({ now: FIXED_NOW });
    fc.assert(fc.property(staleElapsedArb, (elapsed) => {
      expect(getFreshnessState(toIso(elapsed))).toBe(FreshnessState.Stale);
    }), { numRuns: 100 });
  });

  it("classifies timestamps ≥ 24 hours ago as Old", () => {
    vi.useFakeTimers({ now: FIXED_NOW });
    fc.assert(fc.property(oldElapsedArb, (elapsed) => {
      expect(getFreshnessState(toIso(elapsed))).toBe(FreshnessState.Old);
    }), { numRuns: 100 });
  });

  it("classification is exhaustive and mutually exclusive", () => {
    vi.useFakeTimers({ now: FIXED_NOW });
    fc.assert(fc.property(fc.integer({ min: 0, max: 30 * MS_PER_DAY }), (elapsed) => {
      const state = getFreshnessState(toIso(elapsed));
      expect([FreshnessState.Fresh, FreshnessState.Stale, FreshnessState.Old]).toContain(state);
      if (elapsed < MS_PER_HOUR) expect(state).toBe(FreshnessState.Fresh);
      else if (elapsed < MS_PER_DAY) expect(state).toBe(FreshnessState.Stale);
      else expect(state).toBe(FreshnessState.Old);
    }), { numRuns: 200 });
  });

  it("boundary: exactly 1 hour = Stale", () => {
    vi.useFakeTimers({ now: FIXED_NOW });
    expect(getFreshnessState(toIso(MS_PER_HOUR))).toBe(FreshnessState.Stale);
  });

  it("boundary: exactly 24 hours = Old", () => {
    vi.useFakeTimers({ now: FIXED_NOW });
    expect(getFreshnessState(toIso(MS_PER_DAY))).toBe(FreshnessState.Old);
  });

  it("returns Old for null", () => {
    expect(getFreshnessState(null)).toBe(FreshnessState.Old);
  });

  it("getRelativeTime returns 'No scans yet' for null", () => {
    expect(getRelativeTime(null)).toBe("No scans yet");
  });
});
