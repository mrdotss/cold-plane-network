import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import catalogData from "@/data/ata-mappings.v1.json";
import { findMapping, downgradeConfidence, type CatalogEntry } from "@/lib/mapping-engine";

const catalog: CatalogEntry[] = catalogData.mappings as CatalogEntry[];
const catalogTypes = [...new Set(catalog.map((e) => e.azureType.toLowerCase()))];

// Generator: pick a known catalog type
const knownTypeArb = fc.constantFrom(...catalogTypes);

// Generator: a type string guaranteed NOT to be in the catalog
const unknownTypeArb = fc
  .string({ minLength: 1 })
  .filter((s) => !catalogTypes.includes(s.toLowerCase().trim()));

describe("Property 1: Catalog lookup returns correct match status", () => {
  /**
   * **Validates: Requirements 3.1, 3.3**
   * For any known catalog type, findMapping returns matched:true with confidence in {High,Medium,Low}.
   * For any unknown type, findMapping returns matched:false with confidence "None".
   */
  it("returns matched:true with valid confidence for known types", () => {
    fc.assert(
      fc.property(knownTypeArb, (azureType) => {
        const result = findMapping(azureType);
        expect(result.matched).toBe(true);
        expect(["High", "Medium", "Low"]).toContain(result.confidence);
        expect(result.awsServices.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });

  it("returns matched:false with confidence None for unknown types", () => {
    fc.assert(
      fc.property(unknownTypeArb, (azureType) => {
        const result = findMapping(azureType);
        expect(result.matched).toBe(false);
        expect(result.confidence).toBe("None");
        expect(result.awsServices).toEqual([]);
        expect(result.category).toBe("Unknown");
      }),
      { numRuns: 100 }
    );
  });
});

describe("Property 2: Matching priority ordering", () => {
  /**
   * **Validates: Requirements 3.2**
   * For types with kind-specific entries, type+kind match takes priority over generic type match.
   * microsoft.web/sites has a generic entry (Compute) and a kind=functionapp entry (Serverless).
   * microsoft.storage/storageaccounts has generic (Storage/Medium) and kind=blobstorage (Storage/High), kind=storagev2 (Storage/High).
   */
  it("type+kind match takes priority over generic type match", () => {
    // microsoft.web/sites with kind=functionapp should match Serverless (Lambda), not Compute (App Runner)
    const kindResult = findMapping("microsoft.web/sites", "functionapp");
    expect(kindResult.category).toBe("Serverless");
    expect(kindResult.awsServices[0].service).toBe("AWS Lambda");

    // Without kind, should match generic Compute entry
    const genericResult = findMapping("microsoft.web/sites");
    expect(genericResult.category).toBe("Compute");
    expect(genericResult.awsServices[0].service).toBe("AWS App Runner");
  });

  it("more specific kind match overrides generic for storage accounts", () => {
    const blobResult = findMapping("microsoft.storage/storageaccounts", "blobstorage");
    expect(blobResult.confidence).toBe("High");

    const genericResult = findMapping("microsoft.storage/storageaccounts");
    expect(genericResult.confidence).toBe("Medium");
  });

  it("priority ordering holds for any known type with kind refinements", () => {
    // Collect types that have both kind-specific and generic entries
    const typesWithKindRefinements = catalogTypes.filter((t) => {
      const entries = catalog.filter((e) => e.azureType.toLowerCase() === t);
      const hasKind = entries.some((e) => e.azureKind !== null);
      const hasGeneric = entries.some((e) => e.azureKind === null && e.azureSku === null);
      return hasKind && hasGeneric;
    });

    fc.assert(
      fc.property(fc.constantFrom(...typesWithKindRefinements), (azureType) => {
        const entries = catalog.filter((e) => e.azureType.toLowerCase() === azureType);
        const kindEntry = entries.find((e) => e.azureKind !== null)!;
        const genericEntry = entries.find((e) => e.azureKind === null && e.azureSku === null)!;

        // With matching kind, should get the kind-specific entry
        const kindResult = findMapping(azureType, kindEntry.azureKind);
        expect(kindResult.category).toBe(kindEntry.category);

        // Without kind, should get the generic entry
        const genericResult = findMapping(azureType);
        expect(genericResult.category).toBe(genericEntry.category);
      }),
      { numRuns: 100 }
    );
  });
});

describe("Property 3: Fallback confidence downgrade", () => {
  /**
   * **Validates: Requirements 3.4**
   * When a type match exists but kind/SKU don't match any refined entry,
   * the engine falls back to generic entry. If no generic entry exists,
   * it uses the first type match with downgraded confidence.
   */
  it("non-matching kind falls back to generic without downgrade when generic exists", () => {
    // microsoft.web/sites has a generic entry — non-matching kind should get generic
    const result = findMapping("microsoft.web/sites", "nonexistentkind");
    expect(result.matched).toBe(true);
    expect(result.category).toBe("Compute"); // generic entry
  });

  it("downgradeConfidence reduces High→Medium, Medium→Low, Low→Low", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("High" as const, "Medium" as const, "Low" as const),
        (confidence) => {
          const downgraded = downgradeConfidence(confidence);
          if (confidence === "High") expect(downgraded).toBe("Medium");
          else if (confidence === "Medium") expect(downgraded).toBe("Low");
          else expect(downgraded).toBe("Low");
        }
      ),
      { numRuns: 100 }
    );
  });
});
