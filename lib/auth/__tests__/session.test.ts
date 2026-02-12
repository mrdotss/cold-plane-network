import { describe, it, expect, vi } from "vitest";
import * as fc from "fast-check";

// Mock server-only to allow importing in test environment
vi.mock("server-only", () => ({}));

// Mock Prisma client
vi.mock("@/lib/db/client", () => ({
  prisma: {
    session: {
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

import { generateSessionToken } from "../session";

/**
 * Feature: cold-plane-mvp, Property 4: Session token minimum length
 * Validates: Requirements 3.1
 *
 * For any created session, the generated token SHALL decode to at least
 * 32 bytes in length.
 */
describe("Property 4: Session token minimum length", () => {
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
