import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { normalizeResource } from "@/lib/import-utils";

describe("Property 6: Resource normalization lowercases type and extracts SKU", () => {
  /**
   * **Validates: Requirements 2.6**
   * normalizeResource lowercases the type field and extracts SKU from nested objects.
   */
  it("type field is always lowercased", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        (name, type) => {
          const result = normalizeResource({ name, type });
          expect(result.type).toBe(type.toLowerCase());
        }
      ),
      { numRuns: 100 }
    );
  });

  it("extracts SKU name from {name: string} object", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        (skuName) => {
          const result = normalizeResource({
            name: "test",
            type: "microsoft.compute/virtualmachines",
            sku: { name: skuName },
          });
          expect(result.sku).toBe(skuName);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("extracts SKU tier from {tier: string} object when name is absent", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        (skuTier) => {
          const result = normalizeResource({
            name: "test",
            type: "microsoft.compute/virtualmachines",
            sku: { tier: skuTier },
          });
          expect(result.sku).toBe(skuTier);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("preserves string SKU as-is", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        (skuVal) => {
          const result = normalizeResource({
            name: "test",
            type: "microsoft.compute/virtualmachines",
            sku: skuVal,
          });
          expect(result.sku).toBe(skuVal);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("serializes tags and raw as JSON strings", () => {
    fc.assert(
      fc.property(
        fc.dictionary(fc.string({ minLength: 1 }), fc.string()),
        (tags) => {
          const raw = { name: "test", type: "test", tags };
          const result = normalizeResource(raw);
          expect(JSON.parse(result.tags)).toEqual(tags);
          expect(JSON.parse(result.raw)).toEqual(raw);
        }
      ),
      { numRuns: 100 }
    );
  });
});
