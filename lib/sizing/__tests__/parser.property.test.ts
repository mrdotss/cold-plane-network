import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { parsePricingJson } from "@/lib/sizing/parser";
import { serializePricingData } from "@/lib/sizing/serializer";


// --- Generators ---

const pricingArb = fc.record({
  upfront: fc.float({ min: 0, max: 100000, noNaN: true }),
  monthly: fc.float({ min: 0, max: 100000, noNaN: true }),
  first12MonthsTotal: fc.float({ min: 0, max: 1000000, noNaN: true }),
});

const serviceArb = fc.record({
  serviceName: fc.string({ minLength: 1, maxLength: 30 }),
  region: fc.string({ minLength: 1, maxLength: 20 }),
  description: fc.string({ maxLength: 50 }),
  configurationSummary: fc.string({ maxLength: 50 }),
  pricing: fc.record({
    onDemand: pricingArb,
    ri1Year: pricingArb,
    ri3Year: pricingArb,
  }),
});

const groupArb = fc.record({
  name: fc.string({ minLength: 1, maxLength: 30 }),
  services: fc.array(serviceArb, { minLength: 1, maxLength: 3 }),
});

const estimateArb = fc.record({
  estimateName: fc.string({ minLength: 1, maxLength: 30 }),
  currency: fc.constantFrom("USD", "EUR", "GBP"),
  groups: fc.array(groupArb, { minLength: 1, maxLength: 3 }),
});

describe("Property 1: Pricing parser round-trip", () => {
  /**
   * **Validates: Requirements 1.1, 1.6**
   * For any valid PricingData object, serializing it to the AWS Pricing Calculator
   * JSON format and then parsing it back SHALL produce equivalent pricing values,
   * service names, regions, and group hierarchies.
   */
  it("parse(serialize(parse(json))) preserves all pricing data", () => {
    fc.assert(
      fc.property(estimateArb, (rawEstimate) => {
        const jsonString = JSON.stringify(rawEstimate);

        // First parse
        const result1 = parsePricingJson(jsonString);
        expect(result1.success).toBe(true);
        if (!result1.success) return;

        // Serialize back
        const serialized = serializePricingData(result1.data);

        // Second parse
        const result2 = parsePricingJson(serialized);
        expect(result2.success).toBe(true);
        if (!result2.success) return;

        const d1 = result1.data;
        const d2 = result2.data;

        // Verify top-level fields
        expect(d2.fileName).toBe(d1.fileName);
        expect(d2.currency).toBe(d1.currency);
        expect(d2.serviceCount).toBe(d1.serviceCount);
        expect(d2.regions).toEqual(d1.regions);
        expect(d2.regionCount).toBe(d1.regionCount);

        // Verify each tier
        expect(d2.tiers.length).toBe(d1.tiers.length);
        for (let ti = 0; ti < d1.tiers.length; ti++) {
          const t1 = d1.tiers[ti];
          const t2 = d2.tiers[ti];
          expect(t2.tierName).toBe(t1.tierName);
          expect(t2.groups.length).toBe(t1.groups.length);

          for (let gi = 0; gi < t1.groups.length; gi++) {
            const g1 = t1.groups[gi];
            const g2 = t2.groups[gi];
            expect(g2.name).toBe(g1.name);
            expect(g2.services.length).toBe(g1.services.length);

            for (let si = 0; si < g1.services.length; si++) {
              const s1 = g1.services[si];
              const s2 = g2.services[si];
              expect(s2.serviceName).toBe(s1.serviceName);
              expect(s2.region).toBe(s1.region);
              expect(s2.description).toBe(s1.description);
              expect(s2.configurationSummary).toBe(s1.configurationSummary);
              expect(s2.upfront).toBeCloseTo(s1.upfront, 5);
              expect(s2.monthly).toBeCloseTo(s1.monthly, 5);
              expect(s2.first12MonthsTotal).toBeCloseTo(s1.first12MonthsTotal, 5);
            }
          }
        }
      }),
      { numRuns: 100 }
    );
  });
});

describe("Property 2: Parser rejects structurally invalid input", () => {
  /**
   * **Validates: Requirements 1.2**
   * For any JSON object that is missing required top-level fields or has fields
   * of incorrect types, parsePricingJson() SHALL return { success: false }
   * with a non-empty errors array.
   */
  it("rejects non-object JSON values", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.integer(),
          fc.boolean(),
          fc.constant(null),
          fc.string({ minLength: 0, maxLength: 20 }),
          fc.array(fc.integer())
        ),
        (input) => {
          const result = parsePricingJson(JSON.stringify(input));
          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.errors.length).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it("rejects objects with groups containing invalid services", () => {
    fc.assert(
      fc.property(
        fc.record({
          groups: fc.array(
            fc.record({
              name: fc.string({ minLength: 1 }),
              services: fc.array(
                fc.record({
                  // Missing serviceName and region — should fail validation
                  pricing: fc.constant({}),
                }),
                { minLength: 1, maxLength: 2 }
              ),
            }),
            { minLength: 1, maxLength: 2 }
          ),
        }),
        (obj) => {
          const result = parsePricingJson(JSON.stringify(obj));
          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.errors.length).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it("rejects groups with missing name or services", () => {
    fc.assert(
      fc.property(
        fc.record({
          groups: fc.array(
            fc.record({
              // missing name and services
              extra: fc.string(),
            }),
            { minLength: 1, maxLength: 3 }
          ),
        }),
        (obj) => {
          const result = parsePricingJson(JSON.stringify(obj));
          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.errors.length).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it("rejects invalid JSON strings", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter((s) => {
          try { JSON.parse(s); return false; } catch { return true; }
        }),
        (badJson) => {
          const result = parsePricingJson(badJson);
          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.errors.length).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

import { detectPricingTiers } from "@/lib/sizing/parser";
import type { PricingData, PricingTier } from "@/lib/sizing/types";

const ALL_TIER_KEYS = ["onDemand", "ri1Year", "ri3Year"] as const;
const TIER_KEY_TO_NAME: Record<string, PricingTier["tierName"]> = {
  onDemand: "On-Demand",
  ri1Year: "RI 1-Year",
  ri3Year: "RI 3-Year",
};

/** Generate a PricingData where each tier's non-zero status is controlled by the boolean tuple. */
const pricingDataWithTierFlags = (
  tierFlags: [boolean, boolean, boolean]
): fc.Arbitrary<PricingData> =>
  fc.tuple(
    fc.string({ minLength: 1, maxLength: 20 }),
    fc.constantFrom("USD", "EUR", "GBP")
  ).chain(([fileName, currency]) => {
    const tierArbs = ALL_TIER_KEYS.map((key, i) => {
      const hasNonZero = tierFlags[i];
      const baseSvc = {
        groupHierarchy: fc.string({ minLength: 1, maxLength: 20 }),
        region: fc.string({ minLength: 1, maxLength: 20 }),
        description: fc.string({ maxLength: 30 }),
        serviceName: fc.string({ minLength: 1, maxLength: 20 }),
        specification: fc.string({ maxLength: 20 }),
        currency: fc.constant(currency),
        configurationSummary: fc.string({ maxLength: 30 }),
        properties: fc.constant({} as Record<string, string>),
      };
      const svcArb = hasNonZero
        ? fc.record({
            ...baseSvc,
            upfront: fc.float({ min: 0, max: 10000, noNaN: true }),
            monthly: fc.float({ min: Math.fround(0.01), max: 10000, noNaN: true }),
            first12MonthsTotal: fc.float({ min: 0, max: 100000, noNaN: true }),
          })
        : fc.record({
            ...baseSvc,
            upfront: fc.constant(0),
            monthly: fc.constant(0),
            first12MonthsTotal: fc.constant(0),
          });

      return fc.array(svcArb, { minLength: 1, maxLength: 3 }).map((services) => {
        const subtotalUpfront = services.reduce((s, v) => s + v.upfront, 0);
        const subtotalMonthly = services.reduce((s, v) => s + v.monthly, 0);
        const subtotalFirst12 = services.reduce((s, v) => s + v.first12MonthsTotal, 0);
        return {
          tierName: TIER_KEY_TO_NAME[key],
          groups: [
            {
              name: services[0].groupHierarchy,
              services,
              subtotalUpfront,
              subtotalMonthly,
              subtotalFirst12Months: subtotalFirst12,
            },
          ],
          grandTotalUpfront: subtotalUpfront,
          grandTotalMonthly: subtotalMonthly,
          grandTotalFirst12Months: subtotalFirst12,
        } as PricingTier;
      });
    });

    return fc.tuple(tierArbs[0], tierArbs[1], tierArbs[2]).map(
      ([od, ri1, ri3]) =>
        ({
          fileName,
          serviceCount: od.groups[0].services.length,
          regionCount: 1,
          regions: [od.groups[0].services[0].region],
          tiers: [od, ri1, ri3],
          totalMonthly: Math.max(
            od.grandTotalMonthly,
            ri1.grandTotalMonthly,
            ri3.grandTotalMonthly
          ),
          totalAnnual:
            Math.max(
              od.grandTotalMonthly,
              ri1.grandTotalMonthly,
              ri3.grandTotalMonthly
            ) * 12,
          currency,
        }) as PricingData
    );
  });

describe("Property 4: Tier detection correctness", () => {
  /**
   * // Feature: sizing-v2-chatbot, Property 4: Tier detection correctness
   * **Validates: Requirements 3.3**
   * For any valid PricingData where a tier has at least one service with non-zero
   * monthly or upfront values, detectPricingTiers should classify that tier as "present".
   * For any tier where all services have zero monthly and zero upfront, it should be
   * classified as "missing".
   */

  it("partitions all three tiers with no overlap and full coverage", () => {
    // Generate all 8 combinations of tier presence (true/false for each of 3 tiers)
    const flagCombos: [boolean, boolean, boolean][] = [
      [false, false, false],
      [true, false, false],
      [false, true, false],
      [false, false, true],
      [true, true, false],
      [true, false, true],
      [false, true, true],
      [true, true, true],
    ];

    fc.assert(
      fc.property(
        fc.constantFrom(...flagCombos).chain((flags) =>
          pricingDataWithTierFlags(flags).map((data) => ({ data, flags }))
        ),
        ({ data, flags }) => {
          const result = detectPricingTiers(data);

          // Union must equal all three keys
          const union = [...result.presentTiers, ...result.missingTiers].sort();
          expect(union).toEqual([...ALL_TIER_KEYS].sort());

          // Intersection must be empty
          const intersection = result.presentTiers.filter((t) =>
            result.missingTiers.includes(t)
          );
          expect(intersection).toEqual([]);

          // Each tier's classification matches the flag
          ALL_TIER_KEYS.forEach((key, i) => {
            if (flags[i]) {
              expect(result.presentTiers).toContain(key);
            } else {
              expect(result.missingTiers).toContain(key);
            }
          });
        }
      ),
      { numRuns: 100 }
    );
  });
});


describe("Property 5: Parser preserves Properties round-trip", () => {
  /**
   * // Feature: sizing-v2-chatbot, Property 5: Parser preserves Properties round-trip
   * **Validates: Requirements 4.3, 4.6**
   * For any valid AWS Pricing Calculator JSON containing services with a Properties
   * object, parsing the JSON into PricingData should preserve all property keys and
   * values in the resulting PricingService.properties field.
   */

  /** Generate a Properties object with realistic AWS-style key-value pairs. */
  const propertiesArb = fc.dictionary(
    fc.stringMatching(/^[A-Za-z][A-Za-z0-9 ()-]{0,29}$/),
    fc.stringMatching(/^[A-Za-z0-9][A-Za-z0-9 ./-]{0,29}$/),
    { minKeys: 1, maxKeys: 8 }
  );

  /** Generate an AWS-format service with Properties. */
  const awsServiceArb = fc.tuple(propertiesArb).chain(([properties]) =>
    fc.record({
      "Service Name": fc.stringMatching(/^[A-Za-z][A-Za-z0-9 ]{0,19}$/),
      "Region": fc.constantFrom("US East (N. Virginia)", "EU (Ireland)", "Asia Pacific (Tokyo)"),
      "Description": fc.string({ maxLength: 30 }),
      "Properties": fc.constant(properties),
      "Service Cost": fc.record({
        upfront: fc.float({ min: 0, max: 10000, noNaN: true }),
        monthly: fc.float({ min: 0, max: 10000, noNaN: true }),
        "12 months": fc.float({ min: 0, max: 100000, noNaN: true }),
      }),
    })
  );

  const awsEstimateArb = fc.record({
    Name: fc.string({ minLength: 1, maxLength: 20 }),
    Metadata: fc.record({ Currency: fc.constantFrom("USD", "EUR") }),
    Groups: fc.array(
      fc.record({
        "Plan Name": fc.string({ minLength: 1, maxLength: 20 }),
        Services: fc.array(awsServiceArb, { minLength: 1, maxLength: 3 }),
      }),
      { minLength: 1, maxLength: 2 }
    ),
  });

  it("preserves all property keys and values from AWS JSON", () => {
    fc.assert(
      fc.property(awsEstimateArb, (estimate) => {
        const jsonString = JSON.stringify(estimate);
        const result = parsePricingJson(jsonString);
        expect(result.success).toBe(true);
        if (!result.success) return;

        // Collect expected properties per service (flattened across groups)
        const expectedProps: Record<string, string>[] = [];
        for (const group of estimate.Groups) {
          for (const svc of group.Services) {
            const props: Record<string, string> = {};
            for (const [k, v] of Object.entries(svc.Properties)) {
              props[k] = String(v);
            }
            expectedProps.push(props);
          }
        }

        // Check each tier's services have the correct properties
        // All tiers share the same service list, so check On-Demand tier
        const odTier = result.data.tiers.find((t) => t.tierName === "On-Demand");
        expect(odTier).toBeDefined();
        if (!odTier) return;

        let svcIdx = 0;
        for (const group of odTier.groups) {
          for (const svc of group.services) {
            const expected = expectedProps[svcIdx];
            // Every key-value from the original Properties should be in svc.properties
            for (const [key, val] of Object.entries(expected)) {
              expect(svc.properties[key]).toBe(val);
            }
            svcIdx++;
          }
        }
      }),
      { numRuns: 100 }
    );
  });
});
