import { describe, it, expect, vi } from "vitest";
import * as fc from "fast-check";

// Mock server-only
vi.mock("server-only", () => ({}));

// Mock @azure/identity — not needed for prompt construction tests
vi.mock("@azure/identity", () => ({
  DefaultAzureCredential: vi.fn(),
  ClientSecretCredential: vi.fn(),
}));

import { buildAgentPrompt } from "@/lib/sizing/agent-client";

describe("Property 6: Agent prompt includes pricing context and description", () => {
  /**
   * **Validates: Requirements 3.1**
   * For any non-empty pricing context and user description,
   * the constructed prompt SHALL contain both strings.
   */
  it("prompt contains both pricing context and user description", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 5000 }),
        fc.string({ minLength: 1, maxLength: 2000 }),
        (pricingContext, userDescription) => {
          const prompt = buildAgentPrompt(pricingContext, userDescription);

          expect(prompt).toContain(pricingContext);
          expect(prompt).toContain(userDescription);
        }
      ),
      { numRuns: 100 }
    );
  });
});

import { buildAutofillPrompt } from "@/lib/sizing/agent-client";

const VALID_TIERS = ["onDemand", "ri1Year", "ri3Year"] as const;

const TIER_DISPLAY: Record<string, string> = {
  onDemand: "on-demand",
  ri1Year: "ri 1-year",
  ri3Year: "ri 3-year",
};

describe("Property 6: Autofill prompt includes full properties", () => {
  /**
   * // Feature: sizing-v2-chatbot, Property 6: Autofill prompt includes full properties
   * **Validates: Requirements 4.4**
   * For any list of AutofillServiceInput objects with non-empty properties maps,
   * the string returned by buildAutofillPrompt should contain every property key
   * and every property value from every service in the input.
   */

  /** Generate AutofillServiceInput with properties (new format). */
  const serviceInputArb = fc.record({
    serviceName: fc.stringMatching(/^[A-Za-z][A-Za-z0-9 ]{0,19}$/),
    description: fc.stringMatching(/^[a-z][a-z0-9.]{0,9}$/),
    region: fc.constantFrom("US East (N. Virginia)", "EU (Ireland)"),
    properties: fc.dictionary(
      fc.stringMatching(/^[A-Za-z][A-Za-z0-9 ]{0,14}$/),
      fc.stringMatching(/^[a-z0-9][a-z0-9. ]{0,14}$/),
      { minKeys: 1, maxKeys: 5 }
    ),
    currentPricing: fc.option(
      fc.record({
        monthly: fc.stringMatching(/^\d+\.\d{2}$/),
        upfront: fc.stringMatching(/^\d+\.\d{2}$/),
        twelve_months: fc.stringMatching(/^\d+\.\d{2}$/),
      }),
      { nil: undefined }
    ),
  });

  it("prompt contains all property keys and values from every service", () => {
    fc.assert(
      fc.property(
        fc.array(serviceInputArb, { minLength: 1, maxLength: 5 }),
        fc.constantFrom(...VALID_TIERS),
        fc.subarray([...VALID_TIERS], { minLength: 1 }),
        (services, inputTier, missingTiers) => {
          const prompt = buildAutofillPrompt(services, inputTier, missingTiers);

          // Every service's name, description, and region appear
          for (const svc of services) {
            expect(prompt).toContain(svc.serviceName);
            expect(prompt).toContain(svc.description);
            expect(prompt).toContain(svc.region);

            // Every property key and value appears in the prompt
            for (const [key, val] of Object.entries(svc.properties)) {
              expect(prompt).toContain(key);
              expect(prompt).toContain(val);
            }
          }

          // Input tier display name appears
          const lowerPrompt = prompt.toLowerCase();
          expect(lowerPrompt).toContain(TIER_DISPLAY[inputTier]);

          // Each missing tier display name appears
          for (const mt of missingTiers) {
            expect(lowerPrompt).toContain(TIER_DISPLAY[mt]);
          }

          // Strict JSON instruction
          expect(prompt).toContain("Return ONLY valid JSON");
        }
      ),
      { numRuns: 100 }
    );
  });
});
