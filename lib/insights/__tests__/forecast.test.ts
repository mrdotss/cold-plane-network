import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/client", () => ({ db: {} }));
vi.mock("@/lib/db/schema", () => ({}));

import { linearRegression, classifyTrend } from "../forecast";

describe("linearRegression", () => {
  it("returns m=0, b=0 for empty array", () => {
    expect(linearRegression([])).toEqual({ m: 0, b: 0 });
  });

  it("returns m=0, b=y for single point", () => {
    expect(linearRegression([{ x: 3, y: 7 }])).toEqual({ m: 0, b: 7 });
  });

  it("computes perfect fit for two points", () => {
    const { m, b } = linearRegression([
      { x: 0, y: 0 },
      { x: 10, y: 20 },
    ]);
    expect(m).toBeCloseTo(2, 5);
    expect(b).toBeCloseTo(0, 5);
  });

  it("handles identical x values (vertical line)", () => {
    const { m, b } = linearRegression([
      { x: 5, y: 10 },
      { x: 5, y: 20 },
      { x: 5, y: 30 },
    ]);
    expect(m).toBe(0);
    expect(b).toBeCloseTo(20, 5); // mean of y values
  });

  it("handles identical y values (horizontal line)", () => {
    const { m, b } = linearRegression([
      { x: 1, y: 5 },
      { x: 2, y: 5 },
      { x: 3, y: 5 },
    ]);
    expect(m).toBeCloseTo(0, 5);
    expect(b).toBeCloseTo(5, 5);
  });

  it("handles negative slope", () => {
    const { m, b } = linearRegression([
      { x: 0, y: 100 },
      { x: 10, y: 50 },
    ]);
    expect(m).toBeCloseTo(-5, 5);
    expect(b).toBeCloseTo(100, 5);
  });
});

describe("classifyTrend", () => {
  it("returns up for 10%", () => {
    expect(classifyTrend(10)).toBe("up");
  });

  it("returns down for -10%", () => {
    expect(classifyTrend(-10)).toBe("down");
  });

  it("returns stable for 3%", () => {
    expect(classifyTrend(3)).toBe("stable");
  });

  it("returns stable for -3%", () => {
    expect(classifyTrend(-3)).toBe("stable");
  });

  it("returns up at exactly 5%", () => {
    expect(classifyTrend(5)).toBe("up");
  });

  it("returns down at exactly -5%", () => {
    expect(classifyTrend(-5)).toBe("down");
  });
});
