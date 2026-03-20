/** Represents a single service line item from the AWS Pricing Calculator export. */
export interface PricingService {
  groupHierarchy: string;
  region: string;
  description: string;
  serviceName: string;
  /** Key spec detail: instance type, storage class, node type, etc. */
  specification: string;
  upfront: number;
  monthly: number;
  first12MonthsTotal: number;
  currency: string;
  configurationSummary: string;
  /** Raw Properties from AWS JSON — preserved for autofill accuracy */
  properties: Record<string, string>;
}

/** Represents a group of services with subtotals. */
export interface PricingGroup {
  name: string;
  services: PricingService[];
  subtotalUpfront: number;
  subtotalMonthly: number;
  subtotalFirst12Months: number;
}

/** Represents a pricing tier (On-Demand, RI 1-Year, RI 3-Year). */
export interface PricingTier {
  tierName: "On-Demand" | "RI 1-Year" | "RI 3-Year";
  groups: PricingGroup[];
  grandTotalUpfront: number;
  grandTotalMonthly: number;
  grandTotalFirst12Months: number;
}

/** The complete parsed pricing data structure. */
export interface PricingData {
  fileName: string;
  serviceCount: number;
  regionCount: number;
  regions: string[];
  tiers: PricingTier[];
  totalMonthly: number;
  totalAnnual: number;
  currency: string;
}

/** Result of parsing — either success with data or failure with errors. */
export type ParseResult =
  | { success: true; data: PricingData }
  | { success: false; errors: string[] };

/** Summary stats stored in SizingReport.metadata. */
export interface ReportMetadata {
  regions: string[];
  currency: string;
  tierBreakdown: {
    tierName: string;
    monthly: number;
    annual: number;
  }[];
}

/** Result of detecting which pricing tiers are present/missing in parsed data. */
export interface TierDetectionResult {
  /** Which tier(s) have non-zero pricing data */
  presentTiers: Array<"onDemand" | "ri1Year" | "ri3Year">;
  /** Which tier(s) have all-zero pricing */
  missingTiers: Array<"onDemand" | "ri1Year" | "ri3Year">;
}

/** A single service sent to the autofill API for pricing lookup. */
export interface AutofillServiceInput {
  serviceName: string;
  description: string;
  region: string;
  /** Full Properties object from AWS Pricing Calculator JSON */
  properties: Record<string, string>;
  /** Current pricing for this service in the uploaded tier */
  currentPricing?: {
    monthly: string;
    upfront: string;
    twelve_months: string;
  };
}

/** Request body for POST /api/sizing/autofill. */
export interface AutofillRequest {
  services: AutofillServiceInput[];
  inputTier: "onDemand" | "ri1Year" | "ri3Year";
  missingTiers: Array<"onDemand" | "ri1Year" | "ri3Year">;
}

/** A single service result returned by the CPN Agent with pricing for requested tiers. */
export interface AutofillServiceResult {
  service: string;
  description: string;
  region: string;
  onDemand?: { upfront: number; monthly: number };
  ri1Year?: { upfront: number; monthly: number };
  ri3Year?: { upfront: number; monthly: number };
}

/** Response from the autofill API containing agent-returned pricing. */
export interface AutofillResponse {
  services: AutofillServiceResult[];
}
