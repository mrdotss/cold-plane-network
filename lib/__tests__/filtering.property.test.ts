import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { filterByConfidence, filterByCategory, applyFilters, type MappingRow } from "../filtering";

/**
 * Feature: ata-migration-advisor
 * Property 14: Table filtering returns only matching items
 * Validates: Requirements 4.2, 4.3
 */

const confidenceLevels = ["High", "Medium", "Low", "None"] as const;
const categories = ["Compute", "Storage", "Networking", "Database", "Containers", "Serverless"] as const;

const mappingRowArb: fc.Arbitrary<MappingRow> = fc.record({
  name: fc.string({ minLength: 1, maxLength: 20 }),
  type: fc.string({ minLength: 1, maxLength: 40 }),
  location: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: null }),
  awsService: fc.string({ minLength: 1, maxLength: 30 }),
  awsCategory: fc.constantFrom(...categories),
  confidence: fc.constantFrom(...confidenceLevels),
  rationale: fc.string({ maxLength: 50 }),
  migrationNotes: fc.string({ maxLength: 50 }),
  alternatives: fc.constant("[]"),
});

describe("Property 14: Table filtering returns only matching items", () => {
  it("confidence filter returns only items with matching confidence", () => {
    fc.assert(
      fc.property(
        fc.array(mappingRowArb, { minLength: 0, maxLength: 30 }),
        fc.constantFrom(...confidenceLevels),
        (items, confidence) => {
          const result = filterByConfidence(items, confidence);
          // Every returned item must match the filter
          expect(result.every((r) => r.confidence === confidence)).toBe(true);
          // Count must match the number of items with that confidence
          const expected = items.filter((i) => i.confidence === confidence).length;
          expect(result.length).toBe(expected);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("category filter returns only items with matching category", () => {
    fc.assert(
      fc.property(
        fc.array(mappingRowArb, { minLength: 0, maxLength: 30 }),
        fc.constantFrom(...categories),
        (items, category) => {
          const result = filterByCategory(items, category);
          expect(result.every((r) => r.awsCategory === category)).toBe(true);
          const expected = items.filter((i) => i.awsCategory === category).length;
          expect(result.length).toBe(expected);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("null filter returns all items unchanged", () => {
    fc.assert(
      fc.property(
        fc.array(mappingRowArb, { minLength: 0, maxLength: 30 }),
        (items) => {
          expect(filterByConfidence(items, null)).toEqual(items);
          expect(filterByCategory(items, null)).toEqual(items);
          expect(applyFilters(items, { confidence: null, category: null })).toEqual(items);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("combined filters return intersection of both criteria", () => {
    fc.assert(
      fc.property(
        fc.array(mappingRowArb, { minLength: 0, maxLength: 30 }),
        fc.constantFrom(...confidenceLevels),
        fc.constantFrom(...categories),
        (items, confidence, category) => {
          const result = applyFilters(items, { confidence, category });
          expect(
            result.every((r) => r.confidence === confidence && r.awsCategory === category)
          ).toBe(true);
          const expected = items.filter(
            (i) => i.confidence === confidence && i.awsCategory === category
          ).length;
          expect(result.length).toBe(expected);
        }
      ),
      { numRuns: 100 }
    );
  });
});
