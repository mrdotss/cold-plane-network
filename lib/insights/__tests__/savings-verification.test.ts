// Feature: phase4-ai-insights, Property 6: Savings verification classification
//
// For any (expectedSavings, actualSavings) where expectedSavings > 0,
// the classifier returns "confirmed" when ratio ≥ 0.8, "partial" when
// ratio in [0.2, 0.8), and "not_realized" when ratio < 0.2.
//
// Validates: Requirements 16.3, 16.4, 16.5

import { describe, it, expect, vi } from "vitest";
import fc from "fast-check";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/client", () => ({ db: {} }));
vi.mock("@/lib/db/schema", () => ({}));
vi.mock("@/lib/notifications/service", () => ({
  createNotification: vi.fn(),
}));

import { classifySavings } from "../savings-verifier";

describe("Property 6: Savings verification classification", () => {
  it("classifies correctly for any positive expectedSavings and non-negative actualSavings", () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(0.01), max: 10000, noNaN: true, noDefaultInfinity: true }),
        fc.float({ min: 0, max: 10000, noNaN: true, noDefaultInfinity: true }),
        (expectedSavings, actualSavings) => {
          const result = classifySavings(expectedSavings, actualSavings);
          const ratio = actualSavings / expectedSavings;

          if (ratio >= 0.8) {
            expect(result).toBe("confirmed");
          } else if (ratio >= 0.2) {
            expect(result).toBe("partial");
          } else {
            expect(result).toBe("not_realized");
          }
        },
      ),
      { numRuns: 500 },
    );
  });

  it("returns confirmed at exactly 80% ratio", () => {
    expect(classifySavings(100, 80)).toBe("confirmed");
  });

  it("returns partial at 79.9% ratio", () => {
    expect(classifySavings(1000, 799)).toBe("partial");
  });

  it("returns partial at exactly 20% ratio", () => {
    expect(classifySavings(100, 20)).toBe("partial");
  });

  it("returns not_realized at 19.9% ratio", () => {
    expect(classifySavings(1000, 199)).toBe("not_realized");
  });

  it("returns confirmed when actual exceeds expected", () => {
    expect(classifySavings(100, 150)).toBe("confirmed");
  });

  it("returns not_realized when actual is 0", () => {
    expect(classifySavings(100, 0)).toBe("not_realized");
  });

  it("returns pending when expectedSavings is 0", () => {
    expect(classifySavings(0, 50)).toBe("pending");
  });

  it("returns pending when expectedSavings is negative", () => {
    expect(classifySavings(-10, 50)).toBe("pending");
  });
});
