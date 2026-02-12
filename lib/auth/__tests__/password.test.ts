import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { hashPassword, verifyPassword } from "../password";

/**
 * Feature: cold-plane-mvp, Property 1: Password hashing produces verifiable hash
 * Validates: Requirements 1.1
 *
 * For any valid password string (≥ 8 characters), hashing it with hashPassword
 * and then verifying the original password against the hash with verifyPassword
 * SHALL return true.
 */
describe("Property 1: Password hashing produces verifiable hash", () => {
  it("hashing then verifying the same password returns true", { timeout: 120_000 }, async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 8, maxLength: 72 }),
        async (password) => {
          const hash = await hashPassword(password);
          const result = await verifyPassword(password, hash);
          expect(result).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
