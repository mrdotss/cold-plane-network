import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { createReportSchema } from "@/lib/sizing/validators";

const VALID_REPORT_TYPES = ["report", "recommend", "full"];

describe("Property 12: ReportType validation rejects invalid values", () => {
  /**
   * **Validates: Requirements 12.3**
   * For any string that is not one of "report", "recommend", or "full",
   * the createReportSchema Zod validator SHALL reject the input with a
   * validation error on the reportType field.
   */
  it("rejects any string that is not a valid reportType", () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => !VALID_REPORT_TYPES.includes(s)),
        (invalidType) => {
          const result = createReportSchema.safeParse({
            fileName: "test.json",
            reportType: invalidType,
          });
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("accepts all valid reportType values", () => {
    for (const validType of VALID_REPORT_TYPES) {
      const result = createReportSchema.safeParse({
        fileName: "test.json",
        reportType: validType,
      });
      expect(result.success).toBe(true);
    }
  });
});

import { autofillRequestSchema } from "@/lib/sizing/validators";

const VALID_TIERS = ["onDemand", "ri1Year", "ri3Year"] as const;

describe("Property 3: Autofill Zod schema rejects invalid requests", () => {
  /**
   * **Validates: Requirements 3.2**
   * For any object that is missing required fields (services, inputTier, or missingTiers),
   * or has an empty services array, or has an inputTier value not in
   * ["onDemand", "ri1Year", "ri3Year"], the autofillRequestSchema.safeParse SHALL return
   * success: false.
   */

  it("rejects objects missing required fields", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          // missing services
          fc.record({
            inputTier: fc.constantFrom(...VALID_TIERS),
            missingTiers: fc.subarray([...VALID_TIERS], { minLength: 1 }),
          }),
          // missing inputTier
          fc.record({
            services: fc.array(
              fc.record({
                serviceName: fc.string({ minLength: 1 }),
                description: fc.string(),
                region: fc.string({ minLength: 1 }),
                configurationSummary: fc.string(),
              }),
              { minLength: 1, maxLength: 5 }
            ),
            missingTiers: fc.subarray([...VALID_TIERS], { minLength: 1 }),
          }),
          // missing missingTiers
          fc.record({
            services: fc.array(
              fc.record({
                serviceName: fc.string({ minLength: 1 }),
                description: fc.string(),
                region: fc.string({ minLength: 1 }),
                configurationSummary: fc.string(),
              }),
              { minLength: 1, maxLength: 5 }
            ),
            inputTier: fc.constantFrom(...VALID_TIERS),
          })
        ),
        (incomplete) => {
          const result = autofillRequestSchema.safeParse(incomplete);
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("rejects empty services array", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...VALID_TIERS),
        fc.subarray([...VALID_TIERS], { minLength: 1 }),
        (inputTier, missingTiers) => {
          const result = autofillRequestSchema.safeParse({
            services: [],
            inputTier,
            missingTiers,
          });
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("rejects invalid inputTier values", () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => !(VALID_TIERS as readonly string[]).includes(s)),
        (invalidTier) => {
          const result = autofillRequestSchema.safeParse({
            services: [
              {
                serviceName: "Amazon EC2",
                description: "m5.xlarge",
                region: "US East (N. Virginia)",
                configurationSummary: "Linux, m5.xlarge",
              },
            ],
            inputTier: invalidTier,
            missingTiers: ["ri1Year"],
          });
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("accepts valid autofill requests", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            serviceName: fc.string({ minLength: 1 }),
            description: fc.string(),
            region: fc.string({ minLength: 1 }),
            configurationSummary: fc.string(),
          }),
          { minLength: 1, maxLength: 5 }
        ),
        fc.constantFrom(...VALID_TIERS),
        fc.subarray([...VALID_TIERS], { minLength: 1 }),
        (services, inputTier, missingTiers) => {
          const result = autofillRequestSchema.safeParse({
            services,
            inputTier,
            missingTiers,
          });
          expect(result.success).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
