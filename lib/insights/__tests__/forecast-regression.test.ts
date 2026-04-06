// Feature: phase4-ai-insights, Property 3: Linear regression centroid
// Feature: phase4-ai-insights, Property 4: Trend classification consistency
//
// Property 3: For any non-empty array of ≥ 2 (x, y) points, the regression
// line y = mx + b passes through the centroid (mean(x), mean(y)) within
// floating-point tolerance (< 0.001).
//
// Property 4: classifyTrend returns "stable" when |changePercent| < 5,
// "up" when ≥ 5, "down" when ≤ -5.
//
// Validates: Requirements 9.3, 9.4

import { describe, it, expect, vi } from "vitest";
import fc from "fast-check";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/client", () => ({ db: {} }));
vi.mock("@/lib/db/schema", () => ({}));

import { linearRegression, classifyTrend } from "../forecast";

// ─── Property 3: Linear regression centroid ──────────────────────────────────

describe("Property 3: Linear regression centroid", () => {
  it("regression line passes through centroid for any ≥ 2 points", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.tuple(
            fc.float({ min: -1e6, max: 1e6, noNaN: true, noDefaultInfinity: true }),
            fc.float({ min: -1e6, max: 1e6, noNaN: true, noDefaultInfinity: true }),
          ),
          { minLength: 2, maxLength: 100 },
        ),
        (tuples) => {
          const points = tuples.map(([x, y]) => ({ x, y }));
          const { m, b } = linearRegression(points);

          const meanX = points.reduce((s, p) => s + p.x, 0) / points.length;
          const meanY = points.reduce((s, p) => s + p.y, 0) / points.length;

          const predicted = m * meanX + b;
          const diff = Math.abs(predicted - meanY);

          // Allow tolerance for floating-point arithmetic
          expect(diff).toBeLessThan(0.001);
        },
      ),
      { numRuns: 200 },
    );
  });

  it("returns flat line for a single point", () => {
    const { m, b } = linearRegression([{ x: 5, y: 10 }]);
    expect(m).toBe(0);
    expect(b).toBe(10);
  });

  it("returns zero slope and zero intercept for empty array", () => {
    const { m, b } = linearRegression([]);
    expect(m).toBe(0);
    expect(b).toBe(0);
  });

  it("computes correct slope for known data", () => {
    // y = 2x + 1: points (0,1), (1,3), (2,5)
    const { m, b } = linearRegression([
      { x: 0, y: 1 },
      { x: 1, y: 3 },
      { x: 2, y: 5 },
    ]);
    expect(m).toBeCloseTo(2, 5);
    expect(b).toBeCloseTo(1, 5);
  });
});

// ─── Property 4: Trend classification consistency ────────────────────────────

describe("Property 4: Trend classification consistency", () => {
  it("returns correct classification for any changePercent", () => {
    fc.assert(
      fc.property(
        fc.float({ min: -100, max: 100, noNaN: true, noDefaultInfinity: true }),
        (changePercent) => {
          const result = classifyTrend(changePercent);

          if (changePercent >= 5) {
            expect(result).toBe("up");
          } else if (changePercent <= -5) {
            expect(result).toBe("down");
          } else {
            expect(result).toBe("stable");
          }
        },
      ),
      { numRuns: 500 },
    );
  });

  it("returns stable at boundary -4.99", () => {
    expect(classifyTrend(-4.99)).toBe("stable");
  });

  it("returns down at boundary -5", () => {
    expect(classifyTrend(-5)).toBe("down");
  });

  it("returns stable at boundary 4.99", () => {
    expect(classifyTrend(4.99)).toBe("stable");
  });

  it("returns up at boundary 5", () => {
    expect(classifyTrend(5)).toBe("up");
  });

  it("returns stable at 0", () => {
    expect(classifyTrend(0)).toBe("stable");
  });
});
