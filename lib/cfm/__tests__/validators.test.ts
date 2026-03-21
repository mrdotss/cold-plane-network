import { describe, it, expect, vi } from "vitest";
import * as fc from "fast-check";

// Mock server-only since validators.ts imports it
vi.mock("server-only", () => ({}));

import { awsAccountIdSchema, roleArnSchema } from "@/lib/cfm/validators";

describe("Property 1: Input validation rejects malformed account data", () => {
  /**
   * **Validates: Requirements 1.4, 1.5, 10.5**
   */

  it("rejects any string that is not exactly 12 digits as AWS Account ID", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 50 }).filter(
          (s) => !/^\d{12}$/.test(s)
        ),
        (malformed) => {
          const result = awsAccountIdSchema.safeParse(malformed);
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("accepts any valid 12-digit string as AWS Account ID", () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^\d{12}$/),
        (valid) => {
          const result = awsAccountIdSchema.safeParse(valid);
          expect(result.success).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("rejects any string not matching arn:aws:iam::<12-digits>:role/.+ as Role ARN", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 100 }).filter(
          (s) => !/^arn:aws:iam::\d{12}:role\/.+$/.test(s)
        ),
        (malformed) => {
          const result = roleArnSchema.safeParse(malformed);
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("accepts any valid Role ARN matching the pattern", () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^\d{12}$/),
        fc.stringMatching(/^[A-Za-z][A-Za-z0-9_+=,.@-]{0,29}$/),
        (accountId, roleName) => {
          const arn = `arn:aws:iam::${accountId}:role/${roleName}`;
          const result = roleArnSchema.safeParse(arn);
          expect(result.success).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
