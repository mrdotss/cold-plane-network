import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/client", () => ({ db: {} }));
vi.mock("@/lib/db/schema", () => ({}));
vi.mock("@/lib/audit/writer", () => ({ writeAuditEvent: vi.fn() }));
vi.mock("@/lib/sizing/agent-client", () => ({ getBearerToken: vi.fn() }));

import { computeCfmDelta, computeCspDelta } from "../digest";

describe("computeCfmDelta", () => {
  it("returns null when no scans exist", () => {
    expect(computeCfmDelta([])).toBeNull();
  });

  it("returns current values with null deltas when only 1 scan exists", () => {
    const scans = [
      {
        summary: { totalMonthlySpend: 4200, totalPotentialSavings: 500, recommendationCount: 10 },
        completedAt: new Date("2026-04-01"),
      },
    ];

    const result = computeCfmDelta(scans);
    expect(result).toEqual({
      currentSpend: 4200,
      currentSavings: 500,
      spendChange: null,
      savingsChange: null,
      newRecommendations: null,
    });
  });

  it("computes deltas between two scans", () => {
    const scans = [
      {
        summary: { totalMonthlySpend: 4704, totalPotentialSavings: 600, recommendationCount: 13 },
        completedAt: new Date("2026-04-07"),
      },
      {
        summary: { totalMonthlySpend: 4200, totalPotentialSavings: 500, recommendationCount: 10 },
        completedAt: new Date("2026-04-01"),
      },
    ];

    const result = computeCfmDelta(scans);
    expect(result).not.toBeNull();
    expect(result!.currentSpend).toBe(4704);
    expect(result!.currentSavings).toBe(600);
    expect(result!.spendChange).toBeCloseTo(12, 0); // ~12% increase
    expect(result!.savingsChange).toBe(100);
    expect(result!.newRecommendations).toBe(3);
  });

  it("handles zero previous spend (avoids division by zero)", () => {
    const scans = [
      {
        summary: { totalMonthlySpend: 100, totalPotentialSavings: 50, recommendationCount: 2 },
        completedAt: new Date("2026-04-07"),
      },
      {
        summary: { totalMonthlySpend: 0, totalPotentialSavings: 0, recommendationCount: 0 },
        completedAt: new Date("2026-04-01"),
      },
    ];

    const result = computeCfmDelta(scans);
    expect(result!.spendChange).toBe(0);
  });

  it("returns null when summary is null", () => {
    const scans = [{ summary: null, completedAt: new Date() }];
    expect(computeCfmDelta(scans)).toBeNull();
  });
});

describe("computeCspDelta", () => {
  it("returns null when no scans exist", () => {
    expect(computeCspDelta([])).toBeNull();
  });

  it("returns current values with null deltas when only 1 scan exists", () => {
    const scans = [
      {
        summary: {
          totalFindings: 15,
          severityBreakdown: { critical: 2, high: 5, medium: 6, low: 2 },
          securityScore: 72,
          categoryBreakdown: {},
        },
        completedAt: new Date("2026-04-01"),
      },
    ];

    const result = computeCspDelta(scans);
    expect(result).toEqual({
      currentScore: 72,
      currentFindings: 15,
      scoreChange: null,
      findingChange: null,
    });
  });

  it("computes deltas between two scans", () => {
    const scans = [
      {
        summary: {
          totalFindings: 10,
          severityBreakdown: { critical: 1, high: 3, medium: 4, low: 2 },
          securityScore: 87,
          categoryBreakdown: {},
        },
        completedAt: new Date("2026-04-07"),
      },
      {
        summary: {
          totalFindings: 15,
          severityBreakdown: { critical: 2, high: 5, medium: 6, low: 2 },
          securityScore: 72,
          categoryBreakdown: {},
        },
        completedAt: new Date("2026-04-01"),
      },
    ];

    const result = computeCspDelta(scans);
    expect(result!.currentScore).toBe(87);
    expect(result!.currentFindings).toBe(10);
    expect(result!.scoreChange).toBe(15); // improved
    expect(result!.findingChange).toBe(-5); // 5 resolved
  });

  it("returns null when summary is null", () => {
    const scans = [{ summary: null, completedAt: new Date() }];
    expect(computeCspDelta(scans)).toBeNull();
  });
});
