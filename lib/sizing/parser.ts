import type {
  PricingData,
  PricingGroup,
  PricingService,
  PricingTier,
  ParseResult,
  TierDetectionResult,
} from "./types";

/**
 * Expected shape of the AWS Pricing Calculator JSON export.
 * The calculator organizes estimates into groups, each containing services
 * with pricing across tiers (On-Demand, RI 1-Year, RI 3-Year).
 */
interface RawEstimate {
  estimateName?: string;
  currency?: string;
  groups: RawGroup[];
}

interface RawGroup {
  name: string;
  services: RawService[];
}

interface RawService {
  serviceName: string;
  region: string;
  description?: string;
  configurationSummary?: string;
  pricing: {
    onDemand?: RawPricing;
    ri1Year?: RawPricing;
    ri3Year?: RawPricing;
  };
}

interface RawPricing {
  upfront?: number;
  monthly?: number;
  first12MonthsTotal?: number;
}

const TIER_KEYS = ["onDemand", "ri1Year", "ri3Year"] as const;
const TIER_NAMES: Record<(typeof TIER_KEYS)[number], PricingTier["tierName"]> = {
  onDemand: "On-Demand",
  ri1Year: "RI 1-Year",
  ri3Year: "RI 3-Year",
};

function toNumber(val: unknown): number {
  if (typeof val === "number" && !Number.isNaN(val)) return val;
  if (typeof val === "string") {
    const n = Number(val);
    if (!Number.isNaN(n)) return n;
  }
  return 0;
}

/**
 * Normalize the real AWS Pricing Calculator JSON export format into our internal format.
 * AWS uses capitalized keys like "Groups", "Services", "Service Name", "Service Cost", etc.
 * Our internal format uses camelCase: "groups", "services", "serviceName", "pricing", etc.
 */
function normalizeAwsFormat(obj: Record<string, unknown>): Record<string, unknown> {
  const root = obj as Record<string, unknown>;

  // If already in our internal format, return as-is
  if (Array.isArray(root.groups)) return root;

  // Map AWS format to internal format
  const normalized: Record<string, unknown> = {};

  // estimateName from "Name"
  normalized.estimateName = root["Name"] ?? root.estimateName ?? "";

  // currency from "Metadata.Currency"
  const metadata = root["Metadata"] as Record<string, unknown> | undefined;
  normalized.currency = metadata?.["Currency"] ?? root.currency ?? "USD";

  // Groups → groups
  const rawGroups = root["Groups"] as Record<string, unknown> | undefined;
  // Detect file-level pricing strategy before normalizing groups
  const fileStrategy = Array.isArray(rawGroups)
    ? detectFilePricingStrategy(rawGroups)
    : "OnDemand";

  if (!rawGroups || typeof rawGroups !== "object") {
    // No Groups at all — might be a flat structure with services at root
    normalized.groups = [];
  } else if (Array.isArray(rawGroups)) {
    normalized.groups = rawGroups.map((g) => normalizeGroup(g, fileStrategy));
  } else {
    // Single group object — wrap in array
    normalized.groups = [normalizeGroup(rawGroups, fileStrategy)];
  }

  // Support plan — sits outside Groups at the root level
  const rawSupport = root["Support"] as Record<string, unknown> | undefined;
  if (rawSupport && typeof rawSupport === "object") {
    const planName = (rawSupport["Plan Name"] ?? "Support Plan") as string;
    const region = (rawSupport["Region"] ?? "All regions") as string;
    const summary = (rawSupport["Summary"] ?? "") as string;
    const serviceCost = rawSupport["Service Cost"] as Record<string, unknown> | undefined;

    const pricing: Record<string, unknown> = {};
    if (serviceCost) {
      pricing.onDemand = {
        upfront: toNumber(serviceCost["upfront"]),
        monthly: toNumber(serviceCost["monthly"]),
        first12MonthsTotal: toNumber(serviceCost["12 months"]),
      };
    }

    const supportService = {
      serviceName: planName,
      region,
      description: summary,
      configurationSummary: summary,
      pricing,
    };

    // Add as a "Support" group
    (normalized.groups as Record<string, unknown>[]).push({
      name: "Support",
      services: [supportService],
    });
  }

  return normalized;
}

/**
 * Detect the dominant pricing strategy across all groups in the file.
 * AWS Calculator exports separate JSON files per pricing strategy, so most/all
 * services in a file share the same strategy. We scan for the first explicit
 * "Pricing strategy" property and use it as the file-level default.
 * Falls back to "OnDemand" if no explicit strategy is found.
 */
function detectFilePricingStrategy(groups: unknown[]): string {
  for (const g of groups) {
    if (typeof g !== "object" || g === null) continue;
    const rawServices = (g as Record<string, unknown>)["Services"];
    if (!Array.isArray(rawServices)) continue;
    for (const svc of rawServices) {
      if (typeof svc !== "object" || svc === null) continue;
      const props = (svc as Record<string, unknown>)["Properties"] as Record<string, unknown> | undefined;
      if (props?.["Pricing strategy"] && typeof props["Pricing strategy"] === "string") {
        return props["Pricing strategy"] as string;
      }
    }
  }
  return "OnDemand";
}

/** Classify a pricing strategy string into a tier key. */
function classifyPricingStrategy(strategy: string): "onDemand" | "ri1Year" | "ri3Year" {
  const lower = strategy.toLowerCase();
  if (lower.includes("3") && lower.includes("year")) return "ri3Year";
  if (lower.includes("1") && lower.includes("year")) return "ri1Year";
  return "onDemand";
}

/**
 * Property keys checked in priority order to extract the service specification
 * (instance type, storage class, node type, etc.) from the AWS Calculator JSON.
 */
const SPEC_PROPERTY_KEYS: string[] = [
  // EC2
  "Advance EC2 instance",
  // RDS, OpenSearch, ElastiCache, MemoryDB, DocumentDB
  "Instance type",
  // ElastiCache, Redshift, Neptune
  "Node type",
  // S3
  "S3 Standard storage",
  "S3 storage class",
  // EBS / storage
  "Storage amount",
  "Volume type",
  // Lambda
  "Architecture",
  // DynamoDB
  "Table class",
  // ECS / Fargate
  "CPU Architecture",
  // CloudFront
  "Data transfer out to internet",
  // EFS
  "Storage class",
];

/**
 * Extract the key specification detail from a service's Properties object.
 * Checks known property keys in priority order and returns the first match.
 * Falls back to empty string if no known key is found.
 */
function extractSpecification(properties: Record<string, unknown> | undefined): string {
  if (!properties || typeof properties !== "object") return "";
  for (const key of SPEC_PROPERTY_KEYS) {
    const val = properties[key];
    if (val !== undefined && val !== null && val !== "") {
      return String(val);
    }
  }
  return "";
}

function normalizeGroup(g: unknown, fileDefaultStrategy: string): Record<string, unknown> {
  if (typeof g !== "object" || g === null) return { name: "", services: [] };
  const group = g as Record<string, unknown>;

  const name = (group["Plan Name"] ?? group["name"] ?? group["Name"] ?? "Default Group") as string;
  const rawServices = group["Services"] ?? group["services"];

  const services: Record<string, unknown>[] = [];
  if (Array.isArray(rawServices)) {
    for (const svc of rawServices) {
      if (typeof svc !== "object" || svc === null) continue;
      const s = svc as Record<string, unknown>;

      const serviceName = (s["Service Name"] ?? s["serviceName"] ?? "") as string;
      const region = (s["Region"] ?? s["region"] ?? "") as string;
      const description = (s["Description"] ?? s["description"] ?? "") as string;

      // Build configurationSummary from Properties if available
      const properties = s["Properties"] as Record<string, unknown> | undefined;
      let configurationSummary = (s["configurationSummary"] ?? "") as string;
      if (properties && typeof properties === "object" && !configurationSummary) {
        configurationSummary = Object.entries(properties)
          .map(([k, v]) => `${k}: ${v}`)
          .join("; ");
      }

      // Parse pricing from "Service Cost" or "pricing"
      const serviceCost = s["Service Cost"] as Record<string, unknown> | undefined;
      const existingPricing = s["pricing"] as Record<string, unknown> | undefined;

      let pricing: Record<string, unknown>;
      if (existingPricing) {
        pricing = existingPricing;
      } else if (serviceCost) {
        // Use per-service strategy if available, otherwise fall back to file-level default
        const pricingStrategy = (properties?.["Pricing strategy"] ?? fileDefaultStrategy) as string;
        const tierPricing = {
          upfront: toNumber(serviceCost["upfront"]),
          monthly: toNumber(serviceCost["monthly"]),
          first12MonthsTotal: toNumber(serviceCost["12 months"]),
        };

        pricing = {};
        const tierKey = classifyPricingStrategy(pricingStrategy);
        pricing[tierKey] = tierPricing;
      } else {
        pricing = {};
      }

      // Preserve raw Properties as string-keyed record for autofill accuracy
      const rawProperties: Record<string, string> = {};
      if (properties && typeof properties === "object") {
        for (const [k, v] of Object.entries(properties)) {
          rawProperties[k] = String(v ?? "");
        }
      }

      services.push({
        serviceName,
        specification: extractSpecification(properties),
        region,
        description,
        configurationSummary,
        properties: rawProperties,
        pricing,
      });
    }
  }

  return { name, services };
}

function validateStructure(obj: unknown): string[] {
  const errors: string[] = [];
  if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    errors.push("Root must be a JSON object");
    return errors;
  }
  const root = obj as Record<string, unknown>;

  // Try to normalize AWS format first
  const normalized = normalizeAwsFormat(root);

  if (!Array.isArray(normalized.groups)) {
    errors.push('Missing or invalid "groups" array');
    return errors;
  }
  // Replace the validation target with normalized data
  // Store normalized on root so parsePricingJson can use it
  (root as Record<string, unknown>).__normalized = normalized;

  for (let gi = 0; gi < normalized.groups.length; gi++) {
    const g = (normalized.groups as Record<string, unknown>[])[gi];
    if (typeof g !== "object" || g === null || Array.isArray(g)) {
      errors.push(`groups[${gi}] must be an object`);
      continue;
    }
    if (typeof g.name !== "string" || g.name.length === 0) {
      errors.push(`groups[${gi}].name must be a non-empty string`);
    }
    if (!Array.isArray(g.services)) {
      errors.push(`groups[${gi}].services must be an array`);
      continue;
    }
    for (let si = 0; si < (g.services as unknown[]).length; si++) {
      const s = (g.services as Record<string, unknown>[])[si];
      if (typeof s !== "object" || s === null || Array.isArray(s)) {
        errors.push(`groups[${gi}].services[${si}] must be an object`);
        continue;
      }
      if (typeof s.serviceName !== "string" || s.serviceName.length === 0) {
        errors.push(`groups[${gi}].services[${si}].serviceName must be a non-empty string`);
      }
      if (typeof s.region !== "string" || s.region.length === 0) {
        errors.push(`groups[${gi}].services[${si}].region must be a non-empty string`);
      }
      if (typeof s.pricing !== "object" || s.pricing === null || Array.isArray(s.pricing)) {
        errors.push(`groups[${gi}].services[${si}].pricing must be an object`);
      }
    }
  }
  return errors;
}

const TIER_NAME_TO_KEY: Record<PricingTier["tierName"], "onDemand" | "ri1Year" | "ri3Year"> = {
  "On-Demand": "onDemand",
  "RI 1-Year": "ri1Year",
  "RI 3-Year": "ri3Year",
};

/**
 * Detect which pricing tiers have non-zero data and which are missing (all zeros).
 * A tier is "present" if it has at least one service with non-zero monthly or upfront values.
 */
export function detectPricingTiers(data: PricingData): TierDetectionResult {
  const presentTiers: TierDetectionResult["presentTiers"] = [];
  const missingTiers: TierDetectionResult["missingTiers"] = [];

  for (const tier of data.tiers) {
    const key = TIER_NAME_TO_KEY[tier.tierName];
    if (!key) continue;

    const hasNonZero = tier.groups.some((group) =>
      group.services.some((svc) => svc.monthly !== 0 || svc.upfront !== 0)
    );

    if (hasNonZero) {
      presentTiers.push(key);
    } else {
      missingTiers.push(key);
    }
  }

  return { presentTiers, missingTiers };
}

/**
 * Parse an AWS Pricing Calculator JSON export string.
 * Validates structure, extracts groups/services/tiers, computes totals.
 * Returns ParseResult — either { success: true, data } or { success: false, errors }.
 */
export function parsePricingJson(jsonString: string): ParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    return { success: false, errors: ["Invalid JSON: unable to parse input"] };
  }

  const structureErrors = validateStructure(parsed);
  if (structureErrors.length > 0) {
    return { success: false, errors: structureErrors };
  }

  // Use normalized data (set by validateStructure)
  const normalizedRoot = (parsed as Record<string, unknown>).__normalized as Record<string, unknown> | undefined;
  const raw = (normalizedRoot ?? parsed) as RawEstimate;
  const currency = typeof raw.currency === "string" && raw.currency.length > 0 ? raw.currency : "USD";
  const fileName = typeof raw.estimateName === "string" && raw.estimateName.length > 0
    ? raw.estimateName
    : "Untitled Estimate";

  // Build per-tier data
  const tierMap = new Map<string, Map<string, PricingService[]>>();
  for (const tierKey of TIER_KEYS) {
    tierMap.set(tierKey, new Map());
  }

  const regionSet = new Set<string>();
  const GLOBAL_REGIONS = new Set(["all", "all regions", "global", ""]);
  let totalServiceCount = 0;

  for (const group of raw.groups) {
    for (const svc of group.services) {
      totalServiceCount++;
      const regionLower = svc.region.toLowerCase().trim();
      if (!GLOBAL_REGIONS.has(regionLower)) {
        regionSet.add(svc.region);
      }

      for (const tierKey of TIER_KEYS) {
        const rawPricing = svc.pricing?.[tierKey];
        const upfront = toNumber(rawPricing?.upfront);
        const monthly = toNumber(rawPricing?.monthly);
        const first12 = toNumber(rawPricing?.first12MonthsTotal);

        const service: PricingService = {
          groupHierarchy: group.name,
          region: svc.region,
          description: svc.description ?? "",
          serviceName: svc.serviceName,
          specification: (svc as unknown as Record<string, unknown>).specification as string ?? "",
          upfront,
          monthly,
          first12MonthsTotal: first12,
          currency,
          configurationSummary: svc.configurationSummary ?? "",
          properties: ((svc as unknown as Record<string, unknown>).properties as Record<string, string>) ?? {},
        };

        const groupMap = tierMap.get(tierKey)!;
        if (!groupMap.has(group.name)) {
          groupMap.set(group.name, []);
        }
        groupMap.get(group.name)!.push(service);
      }
    }
  }

  // Build tiers with groups, subtotals, and grand totals
  const tiers: PricingTier[] = TIER_KEYS.map((tierKey) => {
    const groupMap = tierMap.get(tierKey)!;
    const groups: PricingGroup[] = [];
    let grandTotalUpfront = 0;
    let grandTotalMonthly = 0;
    let grandTotalFirst12 = 0;

    for (const [groupName, services] of groupMap) {
      let subtotalUpfront = 0;
      let subtotalMonthly = 0;
      let subtotalFirst12 = 0;
      for (const svc of services) {
        subtotalUpfront += svc.upfront;
        subtotalMonthly += svc.monthly;
        subtotalFirst12 += svc.first12MonthsTotal;
      }
      groups.push({
        name: groupName,
        services,
        subtotalUpfront,
        subtotalMonthly,
        subtotalFirst12Months: subtotalFirst12,
      });
      grandTotalUpfront += subtotalUpfront;
      grandTotalMonthly += subtotalMonthly;
      grandTotalFirst12 += subtotalFirst12;
    }

    return {
      tierName: TIER_NAMES[tierKey],
      groups,
      grandTotalUpfront,
      grandTotalMonthly,
      grandTotalFirst12Months: grandTotalFirst12,
    };
  });

  // Total monthly/annual — use the tier with the highest monthly total
  // (handles RI-only files where On-Demand tier is all zeros)
  let totalMonthly = 0;
  for (const tier of tiers) {
    if (tier.grandTotalMonthly > totalMonthly) {
      totalMonthly = tier.grandTotalMonthly;
    }
  }
  const totalAnnual = totalMonthly * 12;

  const regions = Array.from(regionSet).sort();

  const data: PricingData = {
    fileName,
    serviceCount: totalServiceCount,
    regionCount: regions.length,
    regions,
    tiers,
    totalMonthly,
    totalAnnual,
    currency,
  };

  return { success: true, data };
}
