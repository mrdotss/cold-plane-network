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

describe("Property 2: Autofill prompt contains all service details and strict JSON instruction", () => {
  /**
   * **Validates: Requirements 3.4, 3.5**
   * For any non-empty array of AutofillServiceInput objects, any valid inputTier,
   * and any non-empty missingTiers array, calling buildAutofillPrompt SHALL produce
   * a string that contains: (a) each service's serviceName, description, and region;
   * (b) the input tier name; (c) each missing tier name; and (d) a strict-JSON instruction.
   */
  it("prompt contains all service details, tier names, and strict JSON instruction", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            serviceName: fc.stringMatching(/^[A-Za-z][A-Za-z0-9 ]{0,19}$/),
            description: fc.stringMatching(/^[a-z][a-z0-9.]{0,9}$/),
            region: fc.constantFrom("US East (N. Virginia)", "EU (Ireland)"),
            configurationSummary: fc.string({ minLength: 1, maxLength: 30 }),
          }),
          { minLength: 1, maxLength: 5 }
        ),
        fc.constantFrom(...VALID_TIERS),
        fc.subarray([...VALID_TIERS], { minLength: 1 }),
        (services, inputTier, missingTiers) => {
          const prompt = buildAutofillPrompt(services, inputTier, missingTiers);

          // (a) Each service's details appear in the prompt
          for (const svc of services) {
            expect(prompt).toContain(svc.serviceName);
            expect(prompt).toContain(svc.description);
            expect(prompt).toContain(svc.region);
          }

          // (b) Input tier display name appears
          const lowerPrompt = prompt.toLowerCase();
          expect(lowerPrompt).toContain(TIER_DISPLAY[inputTier]);

          // (c) Each missing tier display name appears
          for (const mt of missingTiers) {
            expect(lowerPrompt).toContain(TIER_DISPLAY[mt]);
          }

          // (d) Strict JSON instruction
          expect(prompt).toContain("Return ONLY valid JSON");
        }
      ),
      { numRuns: 100 }
    );
  });
});
