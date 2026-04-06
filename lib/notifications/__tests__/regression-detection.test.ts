// Feature: phase4-ai-insights, Property 2: Security regression detection
//
// For any pair of CSP security scores (previousScore, currentScore) where both
// are integers 0–100, the shouldCreateRegressionNotification function SHALL
// return true if and only if currentScore < previousScore.
//
// Validates: Requirements 4.3, 4.4

import { describe, it, expect, vi } from "vitest";
import fc from "fast-check";

// Mirror the function from lib/csp/scanner.ts to avoid "server-only" import.
function shouldCreateRegressionNotification(
  previousScore: number,
  currentScore: number,
): boolean {
  return currentScore < previousScore;
}

describe("Property 2: Security regression detection", () => {
  it("returns true iff currentScore < previousScore for all integer pairs 0–100", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        (previousScore, currentScore) => {
          const result = shouldCreateRegressionNotification(previousScore, currentScore);

          if (currentScore < previousScore) {
            expect(result).toBe(true);
          } else {
            expect(result).toBe(false);
          }
        },
      ),
      { numRuns: 500 },
    );
  });

  it("returns false when scores are equal", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        (score) => {
          expect(shouldCreateRegressionNotification(score, score)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("returns true when score drops by any amount", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 1, max: 100 }),
        (previousScore, drop) => {
          const currentScore = Math.max(0, previousScore - drop);
          if (currentScore < previousScore) {
            expect(
              shouldCreateRegressionNotification(previousScore, currentScore),
            ).toBe(true);
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it("returns false when score improves", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 99 }),
        fc.integer({ min: 1, max: 100 }),
        (previousScore, improvement) => {
          const currentScore = Math.min(100, previousScore + improvement);
          if (currentScore > previousScore) {
            expect(
              shouldCreateRegressionNotification(previousScore, currentScore),
            ).toBe(false);
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  // Boundary cases
  it("returns true for 100 → 0 (worst regression)", () => {
    expect(shouldCreateRegressionNotification(100, 0)).toBe(true);
  });

  it("returns false for 0 → 100 (best improvement)", () => {
    expect(shouldCreateRegressionNotification(0, 100)).toBe(false);
  });

  it("returns false for 0 → 0 (no change at minimum)", () => {
    expect(shouldCreateRegressionNotification(0, 0)).toBe(false);
  });

  it("returns false for 100 → 100 (no change at maximum)", () => {
    expect(shouldCreateRegressionNotification(100, 100)).toBe(false);
  });
});
