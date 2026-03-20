import { describe, it, expect, vi } from "vitest";
import * as fc from "fast-check";

// Mock server-only to allow importing in test environment
vi.mock("server-only", () => ({}));

// Mock Drizzle client
vi.mock("@/lib/db/client", () => ({
  db: {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

vi.mock("@/lib/db/schema", () => ({
  sessions: {
    token: "token",
    id: "id",
    userId: "user_id",
    expiresAt: "expires_at",
    createdAt: "created_at",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_col: unknown, _val: unknown) => ({ type: "eq" })),
}));

import { generateSessionToken } from "../session";

/**
 * Feature: sizing-v2-chatbot, Property 1: Session token minimum length
 * Validates: Requirements 2.1
 *
 * For any created session, the generated token SHALL decode to at least
 * 32 bytes in length.
 */
describe("Property 1: Session token minimum length", () => {
  it("generated token decodes to at least 32 bytes", () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        const token = generateSessionToken();
        const bytes = Buffer.from(token, "hex");
        expect(bytes.length).toBeGreaterThanOrEqual(32);
      }),
      { numRuns: 100 }
    );
  });
});
