import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/client", () => ({ db: {} }));
vi.mock("@/lib/db/schema", () => ({}));
vi.mock("@/lib/notifications/service", () => ({
  createNotification: vi.fn(),
}));

import { normalizeResourceId } from "../correlations";

describe("normalizeResourceId", () => {
  it("extracts second segment from 3-segment ID", () => {
    expect(normalizeResourceId("sg:sg-123:22")).toBe("sg-123");
  });

  it("extracts second segment from 2-segment ID", () => {
    expect(normalizeResourceId("user:admin")).toBe("admin");
  });

  it("returns full string when no colon present", () => {
    expect(normalizeResourceId("root-account")).toBe("root-account");
  });

  it("extracts second segment from 4-segment ID", () => {
    expect(normalizeResourceId("s3:bucket-name:encryption:extra")).toBe("bucket-name");
  });

  it("handles empty string", () => {
    expect(normalizeResourceId("")).toBe("");
  });

  it("handles string starting with colon", () => {
    // ":something:else" → second segment is "something"
    expect(normalizeResourceId(":something:else")).toBe("something");
  });

  it("handles string ending with colon", () => {
    // "prefix:" → second segment is ""
    expect(normalizeResourceId("prefix:")).toBe("");
  });

  it("handles single colon", () => {
    expect(normalizeResourceId(":")).toBe("");
  });
});
