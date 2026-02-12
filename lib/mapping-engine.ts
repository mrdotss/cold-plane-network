import catalogData from "@/data/ata-mappings.v1.json";

export interface AwsServiceMapping {
  service: string;
  category: string;
}

export interface CatalogEntry {
  azureType: string;
  azureKind: string | null;
  azureSku: string | null;
  category: string;
  awsServices: AwsServiceMapping[];
  confidence: "High" | "Medium" | "Low";
  rationale: string;
  migrationNotes: string;
  alternatives: string[];
}

export interface MappingResult {
  matched: boolean;
  awsServices: AwsServiceMapping[];
  confidence: "High" | "Medium" | "Low" | "None";
  rationale: string;
  migrationNotes: string;
  alternatives: string[];
  category: string;
}

const catalog: CatalogEntry[] = catalogData.mappings as CatalogEntry[];

/**
 * Look up mapping for an Azure resource.
 * Matching priority: type+kind+sku > type+kind > type+sku (no kind in catalog) > generic type > fallback with downgraded confidence
 */
export function findMapping(
  azureType: string,
  azureKind?: string | null,
  azureSku?: string | null
): MappingResult {
  const normalizedType = azureType.toLowerCase().trim();
  const normalizedKind = azureKind?.toLowerCase().trim() || null;
  const normalizedSku = azureSku?.toLowerCase().trim() || null;

  const typeMatches = catalog.filter(
    (e) => e.azureType.toLowerCase() === normalizedType
  );

  if (typeMatches.length === 0) {
    return {
      matched: false,
      awsServices: [],
      confidence: "None",
      rationale: `No mapping found for Azure type: ${azureType}`,
      migrationNotes: "This resource type is not yet in the mapping catalog. Manual assessment required.",
      alternatives: [],
      category: "Unknown",
    };
  }

  // Priority 1: exact match on type + kind + sku
  if (normalizedKind && normalizedSku) {
    const exact = typeMatches.find(
      (e) =>
        e.azureKind?.toLowerCase() === normalizedKind &&
        e.azureSku?.toLowerCase() === normalizedSku
    );
    if (exact) return toResult(exact);
  }

  // Priority 2: match on type + kind
  if (normalizedKind) {
    const kindMatch = typeMatches.find(
      (e) => e.azureKind?.toLowerCase() === normalizedKind
    );
    if (kindMatch) return toResult(kindMatch);
  }

  // Priority 3: match on type + sku (only catalog entries without kind)
  if (normalizedSku) {
    const skuMatch = typeMatches.find(
      (e) => e.azureSku?.toLowerCase() === normalizedSku && !e.azureKind
    );
    if (skuMatch) return toResult(skuMatch);
  }

  // Priority 4: generic type match (no kind/sku in catalog entry)
  const generic = typeMatches.find((e) => !e.azureKind && !e.azureSku);
  if (generic) return toResult(generic);

  // Fallback: first type match with downgraded confidence
  const fallback = typeMatches[0];
  return {
    ...toResult(fallback),
    confidence: downgradeConfidence(fallback.confidence),
    rationale: `${fallback.rationale} (kind/sku mismatch — using closest catalog entry)`,
  };
}

function toResult(entry: CatalogEntry): MappingResult {
  return {
    matched: true,
    awsServices: entry.awsServices,
    confidence: entry.confidence,
    rationale: entry.rationale,
    migrationNotes: entry.migrationNotes,
    alternatives: entry.alternatives,
    category: entry.category,
  };
}

export function downgradeConfidence(
  c: "High" | "Medium" | "Low"
): "High" | "Medium" | "Low" {
  if (c === "High") return "Medium";
  if (c === "Medium") return "Low";
  return "Low";
}

/** Get all unique categories from the catalog */
export function getCatalogCategories(): string[] {
  return [...new Set(catalog.map((e) => e.category))];
}

/** Get catalog stats */
export function getCatalogStats() {
  return {
    version: catalogData.version,
    totalMappings: catalog.length,
    categories: getCatalogCategories(),
    uniqueAzureTypes: new Set(catalog.map((e) => e.azureType)).size,
  };
}
