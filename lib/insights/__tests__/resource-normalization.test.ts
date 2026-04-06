// Feature: phase4-ai-insights, Property 5: Resource ID normalization
//
// For any CSP prefixed ID "{prefix}:{rawId}:{suffix}", normalizeResourceId
// extracts rawId (the second colon-delimited segment). For IDs with no colon,
// returns the full string unchanged.
//
// Validates: Requirements 12.1, 12.3

import { describe, it, expect, vi } from "vitest";
import fc from "fast-check";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/client", () => ({ db: {} }));
vi.mock("@/lib/db/schema", () => ({}));
vi.mock("@/lib/notifications/service", () => ({
  createNotification: vi.fn(),
}));

import { normalizeResourceId } from "../correlations";

// Generator for alphanumeric strings (no colons)
const segment = fc.string({ minLength: 1, maxLength: 20 }).filter(
  (s) => !s.includes(":") && s.length > 0,
);

describe("Property 5: Resource ID normalization", () => {
  it("extracts rawId from 3-segment prefixed IDs", () => {
    fc.assert(
      fc.property(segment, segment, segment, (prefix, rawId, suffix) => {
        const cspId = `${prefix}:${rawId}:${suffix}`;
        expect(normalizeResourceId(cspId)).toBe(rawId);
      }),
      { numRuns: 200 },
    );
  });

  it("extracts rawId from 2-segment prefixed IDs", () => {
    fc.assert(
      fc.property(segment, segment, (prefix, rawId) => {
        const cspId = `${prefix}:${rawId}`;
        expect(normalizeResourceId(cspId)).toBe(rawId);
      }),
      { numRuns: 200 },
    );
  });

  it("returns full string for IDs with no colon", () => {
    fc.assert(
      fc.property(segment, (id) => {
        // segment generator doesn't include colons
        expect(normalizeResourceId(id)).toBe(id);
      }),
      { numRuns: 200 },
    );
  });

  it("handles 4-segment IDs (extracts second segment)", () => {
    fc.assert(
      fc.property(segment, segment, segment, segment, (a, b, c, d) => {
        const cspId = `${a}:${b}:${c}:${d}`;
        expect(normalizeResourceId(cspId)).toBe(b);
      }),
      { numRuns: 100 },
    );
  });

  // Known examples from the design doc
  it("normalizes sg:sg-123:22 → sg-123", () => {
    expect(normalizeResourceId("sg:sg-123:22")).toBe("sg-123");
  });

  it("normalizes s3:bucket-name:encryption → bucket-name", () => {
    expect(normalizeResourceId("s3:bucket-name:encryption")).toBe("bucket-name");
  });

  it("normalizes user:admin → admin", () => {
    expect(normalizeResourceId("user:admin")).toBe("admin");
  });

  it("normalizes root-account → root-account (no colon)", () => {
    expect(normalizeResourceId("root-account")).toBe("root-account");
  });
});
