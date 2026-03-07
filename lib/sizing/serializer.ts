import type { PricingData } from "./types";

/**
 * Raw JSON structure matching the AWS Pricing Calculator export format
 * that parsePricingJson() expects.
 */
interface RawEstimate {
  estimateName: string;
  currency: string;
  groups: RawGroup[];
}

interface RawGroup {
  name: string;
  services: RawService[];
}

interface RawService {
  serviceName: string;
  region: string;
  description: string;
  configurationSummary: string;
  pricing: {
    onDemand?: RawPricing;
    ri1Year?: RawPricing;
    ri3Year?: RawPricing;
  };
}

interface RawPricing {
  upfront: number;
  monthly: number;
  first12MonthsTotal: number;
}

const TIER_KEY_MAP: Record<string, "onDemand" | "ri1Year" | "ri3Year"> = {
  "On-Demand": "onDemand",
  "RI 1-Year": "ri1Year",
  "RI 3-Year": "ri3Year",
};

/**
 * Serialize PricingData back to the AWS Pricing Calculator JSON format.
 * Used for round-trip property testing.
 */
export function serializePricingData(data: PricingData): string {
  // Collect unique group names in order from the On-Demand tier
  const onDemandTier = data.tiers.find((t) => t.tierName === "On-Demand");
  if (!onDemandTier) {
    return JSON.stringify({ estimateName: data.fileName, currency: data.currency, groups: [] });
  }

  const groupNames = onDemandTier.groups.map((g) => g.name);

  const rawGroups: RawGroup[] = groupNames.map((groupName) => {
    // Get services from On-Demand tier for this group (defines the service list)
    const odGroup = onDemandTier.groups.find((g) => g.name === groupName);
    const serviceCount = odGroup?.services.length ?? 0;

    const rawServices: RawService[] = [];
    for (let i = 0; i < serviceCount; i++) {
      const pricing: RawService["pricing"] = {};

      for (const tier of data.tiers) {
        const tierKey = TIER_KEY_MAP[tier.tierName];
        if (!tierKey) continue;
        const group = tier.groups.find((g) => g.name === groupName);
        const svc = group?.services[i];
        if (svc) {
          pricing[tierKey] = {
            upfront: svc.upfront,
            monthly: svc.monthly,
            first12MonthsTotal: svc.first12MonthsTotal,
          };
        }
      }

      const svc = odGroup!.services[i];
      rawServices.push({
        serviceName: svc.serviceName,
        region: svc.region,
        description: svc.description,
        configurationSummary: svc.configurationSummary,
        pricing,
      });
    }

    return { name: groupName, services: rawServices };
  });

  const raw: RawEstimate = {
    estimateName: data.fileName,
    currency: data.currency,
    groups: rawGroups,
  };

  return JSON.stringify(raw);
}
