import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { mergePricingData } from "@/lib/sizing/merge";
import type {
  PricingData,
  PricingTier,
  AutofillResponse,
  AutofillServiceResult,
} from "@/lib/sizing/types";

type TierKey = "onDemand" | "ri1Year" | "ri3Year";

const ALL_TIER_KEYS: TierKey[] = ["onDemand", "ri1Year", "ri3Year"];
const TIER_KEY_TO_NAME: Record<TierKey, PricingTier["tierName"]> = {
  onDemand: "On-Demand",
  ri1Year: "RI 1-Year",
  ri3Year: "RI 3-Year",
};

/** Generate a minimal valid PricingData with controlled services across all tiers. */
function buildPricingData(
  services: { serviceName: string; description: string; region: string }[],
  presentTier: TierKey,
  currency = "USD"
): PricingData {
  const tiers: PricingTier[] = ALL_TIER_KEYS.map((key) => {
    const isPresent = key === presentTier;
    const svcList = services.map((s) => ({
      groupHierarchy: "Default",
      region: s.region,
      description: s.description,
      serviceName: s.serviceName,
      specification: "",
      upfront: isPresent ? 100 : 0,
      monthly: isPresent ? 50 : 0,
      first12MonthsTotal: isPresent ? 700 : 0,
      currency,
      configurationSummary: "test config",
    }));
    const subtotalUpfront = svcList.reduce((a, v) => a + v.upfront, 0);
    const subtotalMonthly = svcList.reduce((a, v) => a + v.monthly, 0);
    const subtotalFirst12 = svcList.reduce((a, v) => a + v.first12MonthsTotal, 0);
    return {
      tierName: TIER_KEY_TO_NAME[key],
      groups: [{ name: "Default", services: svcList, subtotalUpfront, subtotalMonthly, subtotalFirst12Months: subtotalFirst12 }],
      grandTotalUpfront: subtotalUpfront,
      grandTotalMonthly: subtotalMonthly,
      grandTotalFirst12Months: subtotalFirst12,
    };
  });

  return {
    fileName: "test",
    serviceCount: services.length,
    regionCount: 1,
    regions: [...new Set(services.map((s) => s.region))],
    tiers,
    totalMonthly: 50 * services.length,
    totalAnnual: 50 * services.length * 12,
    currency,
  };
}

// Arbitraries
const serviceIdentArb = fc.record({
  serviceName: fc.stringMatching(/^[A-Za-z][A-Za-z0-9 ]{0,19}$/),
  description: fc.stringMatching(/^[a-z][a-z0-9.]{0,9}$/),
  region: fc.constantFrom("US East (N. Virginia)", "EU (Ireland)", "Asia Pacific (Tokyo)"),
});

const pricingValArb = fc.record({
  upfront: fc.float({ min: 0, max: 10000, noNaN: true }),
  monthly: fc.float({ min: Math.fround(0.01), max: 10000, noNaN: true }),
});

describe("Property 4: Merge produces correct pricing for matched services", () => {
  /**
   * **Validates: Requirements 4.1, 4.2**
   * For any PricingData and any AutofillResponse where at least one service matches
   * by the composite key (serviceName, description, region), calling mergePricingData
   * SHALL produce a new PricingData where every matched service in the missing tiers
   * has the monthly and upfront values from the AutofillResponse, and every unmatched
   * service retains zero values for the missing tiers.
   */
  it("matched services get agent pricing, unmatched retain zeros", () => {
    fc.assert(
      fc.property(
        // Generate 1-3 services, pick one as the "matched" service
        fc.array(serviceIdentArb, { minLength: 2, maxLength: 4 }),
        fc.constantFrom<TierKey>("onDemand", "ri1Year", "ri3Year"),
        pricingValArb,
        (serviceIdents, presentTier, agentPricing) => {
          const missingTiers = ALL_TIER_KEYS.filter((k) => k !== presentTier);
          const data = buildPricingData(serviceIdents, presentTier);

          // Only the first service gets a match in the autofill response
          const matchedSvc = serviceIdents[0];
          const autofillResult: AutofillServiceResult = {
            service: matchedSvc.serviceName,
            description: matchedSvc.description,
            region: matchedSvc.region,
          };
          for (const mt of missingTiers) {
            autofillResult[mt] = agentPricing;
          }

          const response: AutofillResponse = { services: [autofillResult] };
          const merged = mergePricingData(data, response, missingTiers);

          // Check each missing tier
          for (const mt of missingTiers) {
            const tierIdx = ALL_TIER_KEYS.indexOf(mt);
            const mergedTier = merged.tiers[tierIdx];

            for (const group of mergedTier.groups) {
              for (const svc of group.services) {
                const key = `${svc.serviceName.toLowerCase()}|${svc.description.toLowerCase()}|${svc.region.toLowerCase()}`;
                const matchKey = `${matchedSvc.serviceName.toLowerCase()}|${matchedSvc.description.toLowerCase()}|${matchedSvc.region.toLowerCase()}`;

                if (key === matchKey) {
                  // Matched: should have agent pricing
                  expect(svc.upfront).toBeCloseTo(agentPricing.upfront, 4);
                  expect(svc.monthly).toBeCloseTo(agentPricing.monthly, 4);
                  expect(svc.first12MonthsTotal).toBeCloseTo(
                    agentPricing.upfront + agentPricing.monthly * 12,
                    2
                  );
                } else {
                  // Unmatched: should remain zero
                  expect(svc.upfront).toBe(0);
                  expect(svc.monthly).toBe(0);
                }
              }
            }
          }

          // Present tier should be unchanged
          const presentIdx = ALL_TIER_KEYS.indexOf(presentTier);
          const presentMerged = merged.tiers[presentIdx];
          for (const group of presentMerged.groups) {
            for (const svc of group.services) {
              expect(svc.upfront).toBe(100);
              expect(svc.monthly).toBe(50);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe("Property 5: Merge does not mutate original data", () => {
  /**
   * **Validates: Requirements 4.3**
   * For any PricingData and any AutofillResponse, calling mergePricingData SHALL
   * return a new PricingData object, and the original PricingData object SHALL be
   * deeply equal to its state before the merge call.
   */
  it("original PricingData is unchanged after merge", () => {
    fc.assert(
      fc.property(
        fc.array(serviceIdentArb, { minLength: 1, maxLength: 3 }),
        fc.constantFrom<TierKey>("onDemand", "ri1Year", "ri3Year"),
        pricingValArb,
        (serviceIdents, presentTier, agentPricing) => {
          const missingTiers = ALL_TIER_KEYS.filter((k) => k !== presentTier);
          const data = buildPricingData(serviceIdents, presentTier);

          // Deep snapshot before merge
          const snapshot = JSON.parse(JSON.stringify(data));

          const autofillResult: AutofillServiceResult = {
            service: serviceIdents[0].serviceName,
            description: serviceIdents[0].description,
            region: serviceIdents[0].region,
          };
          for (const mt of missingTiers) {
            autofillResult[mt] = agentPricing;
          }

          const response: AutofillResponse = { services: [autofillResult] };
          const merged = mergePricingData(data, response, missingTiers);

          // Original must be unchanged
          expect(data).toEqual(snapshot);

          // Merged must be a different object reference
          expect(merged).not.toBe(data);
          expect(merged.tiers).not.toBe(data.tiers);
        }
      ),
      { numRuns: 100 }
    );
  });
});
