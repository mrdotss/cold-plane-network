import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock React hooks for server-side test environment
vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return { ...actual };
});

import { getRelativeTime } from "@/lib/freshness/utils";

describe("LastUpdated", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("display logic", () => {
    it('returns "No scans yet" when completedAt is null', () => {
      expect(getRelativeTime(null)).toBe("No scans yet");
    });

    it('returns "Just now" for a timestamp less than 1 minute ago', () => {
      const now = new Date();
      const thirtySecondsAgo = new Date(now.getTime() - 30_000).toISOString();
      expect(getRelativeTime(thirtySecondsAgo)).toBe("Just now");
    });

    it("returns minutes ago for timestamps within the last hour", () => {
      const now = new Date();
      const tenMinutesAgo = new Date(
        now.getTime() - 10 * 60 * 1000
      ).toISOString();
      expect(getRelativeTime(tenMinutesAgo)).toBe("10m ago");
    });

    it("returns hours ago for timestamps within the last day", () => {
      const now = new Date();
      const twoHoursAgo = new Date(
        now.getTime() - 2 * 60 * 60 * 1000
      ).toISOString();
      expect(getRelativeTime(twoHoursAgo)).toBe("2h ago");
    });

    it("returns days ago for timestamps older than 24 hours", () => {
      const now = new Date();
      const threeDaysAgo = new Date(
        now.getTime() - 3 * 24 * 60 * 60 * 1000
      ).toISOString();
      expect(getRelativeTime(threeDaysAgo)).toBe("3d ago");
    });
  });

  describe("auto-update interval", () => {
    it("updates relative time after 60 seconds", () => {
      const baseTime = new Date("2024-01-01T12:00:00Z").getTime();
      vi.setSystemTime(baseTime);

      // At T=0, 5 minutes ago
      const completedAt = new Date(baseTime - 5 * 60 * 1000).toISOString();
      expect(getRelativeTime(completedAt)).toBe("5m ago");

      // Advance 2 minutes — should now show 7m ago
      vi.setSystemTime(baseTime + 2 * 60 * 1000);
      expect(getRelativeTime(completedAt)).toBe("7m ago");
    });
  });
});
