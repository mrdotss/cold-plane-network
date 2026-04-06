import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/client", () => ({ db: {} }));
vi.mock("@/lib/db/schema", () => ({}));
vi.mock("@/lib/notifications/service", () => ({
  createNotification: vi.fn(),
}));

import { classifySavings } from "../savings-verifier";

describe("classifySavings", () => {
  it("returns confirmed when ratio ≥ 0.8", () => {
    expect(classifySavings(100, 80)).toBe("confirmed");
    expect(classifySavings(100, 100)).toBe("confirmed");
    expect(classifySavings(100, 150)).toBe("confirmed");
    expect(classifySavings(50, 45)).toBe("confirmed");
  });

  it("returns partial when ratio in [0.2, 0.8)", () => {
    expect(classifySavings(100, 50)).toBe("partial");
    expect(classifySavings(100, 20)).toBe("partial");
    expect(classifySavings(100, 79)).toBe("partial");
  });

  it("returns not_realized when ratio < 0.2", () => {
    expect(classifySavings(100, 0)).toBe("not_realized");
    expect(classifySavings(100, 10)).toBe("not_realized");
    expect(classifySavings(100, 19)).toBe("not_realized");
  });

  it("returns pending when expectedSavings is 0", () => {
    expect(classifySavings(0, 50)).toBe("pending");
  });

  it("returns pending when expectedSavings is negative", () => {
    expect(classifySavings(-10, 50)).toBe("pending");
  });

  it("handles very small expected savings", () => {
    expect(classifySavings(0.01, 0.01)).toBe("confirmed");
    expect(classifySavings(0.01, 0.005)).toBe("partial");
    expect(classifySavings(0.01, 0.001)).toBe("not_realized");
  });
});
