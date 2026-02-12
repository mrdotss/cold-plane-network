import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { manualResourceSchema, importJsonSchema } from "@/lib/validators/resource";

// Generator: valid Azure resource object with name and type
const validResourceArb = fc.record({
  name: fc.string({ minLength: 1 }),
  type: fc.string({ minLength: 1 }),
  location: fc.option(fc.string(), { nil: undefined }),
  kind: fc.option(fc.string(), { nil: undefined }),
});

describe("Property 4: Import schema accepts three JSON wrapper formats", () => {
  /**
   * **Validates: Requirements 2.4**
   * For any valid array of Azure resource objects, importJsonSchema accepts
   * bare array, {value: [...]}, and {data: [...]}, producing the same result.
   */
  it("all three formats produce the same parsed resource array", () => {
    fc.assert(
      fc.property(
        fc.array(validResourceArb, { minLength: 1, maxLength: 5 }),
        (resources) => {
          const bareResult = importJsonSchema.safeParse(resources);
          const valueResult = importJsonSchema.safeParse({ value: resources });
          const dataResult = importJsonSchema.safeParse({ data: resources });

          expect(bareResult.success).toBe(true);
          expect(valueResult.success).toBe(true);
          expect(dataResult.success).toBe(true);

          if (bareResult.success && valueResult.success && dataResult.success) {
            expect(bareResult.data.length).toBe(resources.length);
            expect(valueResult.data.length).toBe(resources.length);
            expect(dataResult.data.length).toBe(resources.length);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe("Property 5: Import schema rejects invalid input", () => {
  /**
   * **Validates: Requirements 2.5**
   * Input that is not a valid array of objects with name+type strings is rejected.
   */
  it("rejects non-array, non-object input", () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.integer(), fc.boolean(), fc.constant(null)),
        (input) => {
          const result = importJsonSchema.safeParse(input);
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("rejects empty arrays", () => {
    expect(importJsonSchema.safeParse([]).success).toBe(false);
    expect(importJsonSchema.safeParse({ value: [] }).success).toBe(false);
    expect(importJsonSchema.safeParse({ data: [] }).success).toBe(false);
  });

  it("rejects arrays of objects missing name or type", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({ location: fc.string() }), // missing name and type
          { minLength: 1, maxLength: 3 }
        ),
        (resources) => {
          const result = importJsonSchema.safeParse(resources);
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe("Property 11: Manual resource schema rejects empty name or type", () => {
  /**
   * **Validates: Requirements 8.1**
   * manualResourceSchema rejects empty name or empty type.
   */
  it("rejects empty name", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (type) => {
        const result = manualResourceSchema.safeParse({ name: "", type });
        expect(result.success).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it("rejects empty type", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (name) => {
        const result = manualResourceSchema.safeParse({ name, type: "" });
        expect(result.success).toBe(false);
      }),
      { numRuns: 100 }
    );
  });
});

describe("Property 12: Import schema handles flexible SKU formats", () => {
  /**
   * **Validates: Requirements 8.2**
   * importJsonSchema accepts sku as string, {name: string}, or {tier: string}.
   */
  it("accepts string SKU", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (skuVal) => {
        const input = [{ name: "test", type: "microsoft.compute/virtualmachines", sku: skuVal }];
        const result = importJsonSchema.safeParse(input);
        expect(result.success).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it("accepts {name: string} SKU and extracts name", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (skuName) => {
        const input = [{ name: "test", type: "microsoft.compute/virtualmachines", sku: { name: skuName } }];
        const result = importJsonSchema.safeParse(input);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data[0].sku).toBe(skuName);
        }
      }),
      { numRuns: 100 }
    );
  });

  it("accepts {tier: string} SKU and extracts tier", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (skuTier) => {
        const input = [{ name: "test", type: "microsoft.compute/virtualmachines", sku: { tier: skuTier } }];
        const result = importJsonSchema.safeParse(input);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data[0].sku).toBe(skuTier);
        }
      }),
      { numRuns: 100 }
    );
  });
});

describe("Property 13: Validators accept extra fields", () => {
  /**
   * **Validates: Requirements 8.4**
   * Both schemas accept objects with extra fields beyond the defined schema.
   */
  it("manualResourceSchema accepts extra fields", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        (name, type, extraKey, extraVal) => {
          const input = { name, type, [extraKey]: extraVal };
          const result = manualResourceSchema.safeParse(input);
          expect(result.success).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("importJsonSchema accepts extra fields on resource objects", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        (extraKey, extraVal) => {
          const input = [{ name: "test", type: "microsoft.compute/virtualmachines", [extraKey]: extraVal }];
          const result = importJsonSchema.safeParse(input);
          expect(result.success).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
