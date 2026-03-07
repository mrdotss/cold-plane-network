import type {
  PricingData,
  PricingTier,
  AutofillResponse,
  AutofillServiceResult,
} from "./types";

type TierKey = "onDemand" | "ri1Year" | "ri3Year";

const TIER_NAME_TO_KEY: Record<PricingTier["tierName"], TierKey> = {
  "On-Demand": "onDemand",
  "RI 1-Year": "ri1Year",
  "RI 3-Year": "ri3Year",
};

/**
 * AWS services that don't support Reserved Instance pricing.
 * These are pay-as-you-go only — no upfront/reservation options.
 * Matched case-insensitively against service names (substring match).
 */
const RI_INELIGIBLE_PATTERNS: string[] = [
  "s3",
  "support plan",
  "business support",
  "enterprise support",
  "developer support",
  "data transfer",
  "route 53",
  "cloudwatch",
  "secrets manager",
  "certificate manager",
  "vpc",
  "vpn connection",
  "public ipv4",
  "elastic ip",
  "nat gateway",
  "cloudfront",
  "lambda",
  "api gateway",
  "sns",
  "sqs",
  "kinesis",
  "glue",
  "athena",
  "cloudtrail",
  "config",
  "waf",
  "shield",
  "guardduty",
  "inspector",
  "macie",
];

/**
 * Check if a service is eligible for Reserved Instance pricing.
 * Returns false for services that are pay-as-you-go only.
 */
export function isRiEligible(serviceName: string): boolean {
  const lower = serviceName.toLowerCase().trim();
  return !RI_INELIGIBLE_PATTERNS.some((pattern) => lower.includes(pattern));
}

/** Normalize a string for fuzzy matching: lowercase, trim, collapse whitespace. */
function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}

/** Build a composite key for service matching (service name + region only). */
function makeKey(serviceName: string, _description: string, region: string): string {
  return `${normalize(serviceName)}|${normalize(region)}`;
}

/**
 * Build a secondary key using just the normalized service name.
 * Used as a fallback when region formatting differs.
 */
function makeNameKey(serviceName: string): string {
  return normalize(serviceName);
}

/**
 * Merge agent-returned pricing into the original PricingData for missing tiers.
 * Returns a new PricingData without mutating the original.
 */
export function mergePricingData(
  original: PricingData,
  autofillResponse: AutofillResponse,
  missingTiers: TierKey[]
): PricingData {
  // Build lookup maps from autofill response
  // Primary: service name + region
  // Fallback: service name only (for when region formatting differs)
  const lookup = new Map<string, AutofillServiceResult>();
  const nameLookup = new Map<string, AutofillServiceResult>();
  for (const svc of autofillResponse.services) {
    const key = makeKey(svc.service, svc.description, svc.region);
    lookup.set(key, svc);
    const nk = makeNameKey(svc.service);
    if (!nameLookup.has(nk)) {
      nameLookup.set(nk, svc);
    }
  }

  const missingSet = new Set(missingTiers);

  // Deep-clone tiers with updated pricing
  const newTiers: PricingTier[] = original.tiers.map((tier) => {
    const tierKey = TIER_NAME_TO_KEY[tier.tierName];
    const isMissing = missingSet.has(tierKey);

    const newGroups = tier.groups.map((group) => {
      const newServices = group.services.map((svc) => {
        const cloned = { ...svc };

        if (isMissing) {
          const key = makeKey(svc.serviceName, svc.description, svc.region);
          const match = lookup.get(key) ?? nameLookup.get(makeNameKey(svc.serviceName));
          const tierPricing = match?.[tierKey];

          if (tierPricing) {
            cloned.upfront = tierPricing.upfront;
            cloned.monthly = tierPricing.monthly;
            cloned.first12MonthsTotal = tierPricing.upfront + tierPricing.monthly * 12;
          }
        }

        return cloned;
      });

      // Recalculate group subtotals
      const subtotalUpfront = newServices.reduce((s, v) => s + v.upfront, 0);
      const subtotalMonthly = newServices.reduce((s, v) => s + v.monthly, 0);
      const subtotalFirst12Months = newServices.reduce((s, v) => s + v.first12MonthsTotal, 0);

      return {
        ...group,
        services: newServices,
        subtotalUpfront,
        subtotalMonthly,
        subtotalFirst12Months,
      };
    });

    // Recalculate tier grand totals
    const grandTotalUpfront = newGroups.reduce((s, g) => s + g.subtotalUpfront, 0);
    const grandTotalMonthly = newGroups.reduce((s, g) => s + g.subtotalMonthly, 0);
    const grandTotalFirst12Months = newGroups.reduce((s, g) => s + g.subtotalFirst12Months, 0);

    return {
      ...tier,
      groups: newGroups,
      grandTotalUpfront,
      grandTotalMonthly,
      grandTotalFirst12Months,
    };
  });

  // Recalculate top-level totals
  let totalMonthly = 0;
  for (const tier of newTiers) {
    if (tier.grandTotalMonthly > totalMonthly) {
      totalMonthly = tier.grandTotalMonthly;
    }
  }

  return {
    ...original,
    tiers: newTiers,
    totalMonthly,
    totalAnnual: totalMonthly * 12,
  };
}
