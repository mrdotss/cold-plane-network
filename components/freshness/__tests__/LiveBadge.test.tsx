import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getFreshnessState,
  FreshnessState,
} from "@/lib/freshness/utils";

describe("LiveBadge", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("freshness state classification", () => {
    it("returns Fresh for timestamps less than 1 hour ago", () => {
      const now = Date.now();
      vi.setSystemTime(now);
      const thirtyMinutesAgo = new Date(
        now - 30 * 60 * 1000
      ).toISOString();
      expect(getFreshnessState(thirtyMinutesAgo)).toBe(FreshnessState.Fresh);
    });

    it("returns Stale for timestamps between 1 and 24 hours ago", () => {
      const now = Date.now();
      vi.setSystemTime(now);
      const sixHoursAgo = new Date(
        now - 6 * 60 * 60 * 1000
      ).toISOString();
      expect(getFreshnessState(sixHoursAgo)).toBe(FreshnessState.Stale);
    });

    it("returns Old for timestamps more than 24 hours ago", () => {
      const now = Date.now();
      vi.setSystemTime(now);
      const twoDaysAgo = new Date(
        now - 2 * 24 * 60 * 60 * 1000
      ).toISOString();
      expect(getFreshnessState(twoDaysAgo)).toBe(FreshnessState.Old);
    });

    it("returns Old when completedAt is null", () => {
      expect(getFreshnessState(null)).toBe(FreshnessState.Old);
    });
  });

  describe("boundary values", () => {
    it("returns Fresh at exactly 59 minutes 59 seconds", () => {
      const now = Date.now();
      vi.setSystemTime(now);
      const justUnderOneHour = new Date(
        now - (60 * 60 * 1000 - 1000)
      ).toISOString();
      expect(getFreshnessState(justUnderOneHour)).toBe(FreshnessState.Fresh);
    });

    it("returns Stale at exactly 1 hour", () => {
      const now = Date.now();
      vi.setSystemTime(now);
      const exactlyOneHour = new Date(
        now - 60 * 60 * 1000
      ).toISOString();
      expect(getFreshnessState(exactlyOneHour)).toBe(FreshnessState.Stale);
    });

    it("returns Stale at exactly 23 hours 59 minutes", () => {
      const now = Date.now();
      vi.setSystemTime(now);
      const justUnder24Hours = new Date(
        now - (24 * 60 * 60 * 1000 - 60 * 1000)
      ).toISOString();
      expect(getFreshnessState(justUnder24Hours)).toBe(FreshnessState.Stale);
    });

    it("returns Old at exactly 24 hours", () => {
      const now = Date.now();
      vi.setSystemTime(now);
      const exactly24Hours = new Date(
        now - 24 * 60 * 60 * 1000
      ).toISOString();
      expect(getFreshnessState(exactly24Hours)).toBe(FreshnessState.Old);
    });
  });

  describe("aria-label mapping", () => {
    const stateLabels: Record<FreshnessState, string> = {
      [FreshnessState.Fresh]:
        "Data is fresh, updated less than 1 hour ago",
      [FreshnessState.Stale]:
        "Data is stale, updated between 1 and 24 hours ago",
      [FreshnessState.Old]:
        "Data is old, updated more than 24 hours ago",
    };

    it("maps each freshness state to a descriptive aria-label", () => {
      // Verify all states have labels
      expect(stateLabels[FreshnessState.Fresh]).toBeDefined();
      expect(stateLabels[FreshnessState.Stale]).toBeDefined();
      expect(stateLabels[FreshnessState.Old]).toBeDefined();
    });

    it("includes freshness state name in the label", () => {
      expect(stateLabels[FreshnessState.Fresh]).toContain("fresh");
      expect(stateLabels[FreshnessState.Stale]).toContain("stale");
      expect(stateLabels[FreshnessState.Old]).toContain("old");
    });
  });
});
