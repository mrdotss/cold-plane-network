// Feature: sizing-v2-chatbot, Property 15: PricingData summary in chat system prompt
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { buildPricingContext } from "../ChatPanel";
import type { PricingData, PricingTier, PricingGroup } from "@/lib/sizing/types";

/** Arbitrary for a PricingTier with a valid tierName. */
const tierArb = fc
  .record({
    tierName: fc.constantFrom("On-Demand" as const, "RI 1-Year" as const, "RI 3-Year" as const),
    groups: fc.constant([]),
    grandTotalUpfront: fc.float({ min: 0, max: 1e6, noNaN: true }),
    grandTotalMonthly: fc.float({ min: 0, max: 1e6, noNaN: true }),
    grandTotalFirst12Months: fc.float({ min: 0, max: 1e6, noNaN: true }),
  })
  .map((t): PricingTier => ({ ...t, groups: [] as PricingGroup[] }));

/** Arbitrary for a non-null PricingData. */
const pricingDataArb = fc
  .record({
    fileName: fc.string({ minLength: 1, maxLength: 50, unit: "grapheme" }).map(
      (s) => s.trim() || "data.json",
    ),
    serviceCount: fc.integer({ min: 1, max: 500 }),
    regionCount: fc.integer({ min: 1, max: 10 }),
    regions: fc.array(
      fc.string({ minLength: 1, maxLength: 30, unit: "grapheme" }).map(
        (s) => s.trim() || "us-east-1",
      ),
      { minLength: 1, maxLength: 5 },
    ),
    tiers: fc.array(tierArb, { minLength: 1, maxLength: 3 }),
    totalMonthly: fc.float({ min: 0, max: 1e7, noNaN: true }),
    totalAnnual: fc.float({ min: 0, max: 1e8, noNaN: true }),
    currency: fc.constantFrom("USD", "EUR", "GBP"),
  })
  .map((d): PricingData => d);

const fileNameArb = fc.string({ minLength: 1, maxLength: 50, unit: "grapheme" }).map(
  (s) => s.trim() || "estimate.json",
);

describe("Property 15: PricingData summary in chat system prompt", () => {
  it("contains service count, region, total monthly, and tier names", () => {
    fc.assert(
      fc.property(pricingDataArb, fileNameArb, (data, fileName) => {
        const context = buildPricingContext(data, fileName);

        // Must contain service count
        expect(context).toContain(String(data.serviceCount));

        // Must contain at least one region name
        const hasRegion = data.regions.some((r) => context.includes(r));
        expect(hasRegion).toBe(true);

        // Must contain total monthly cost (formatted with toFixed(2))
        expect(context).toContain(data.totalMonthly.toFixed(2));

        // Must contain tier names
        for (const tier of data.tiers) {
          expect(context).toContain(tier.tierName);
        }

        // Must contain currency
        expect(context).toContain(data.currency);
      }),
      { numRuns: 100 },
    );
  });
});
