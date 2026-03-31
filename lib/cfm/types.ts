// ─── Account ─────────────────────────────────────────────────────────────────

export interface CfmAccount {
  id: string;
  userId: string;
  accountName: string;
  awsAccountId: string; // 12-digit string
  roleArn: string; // arn:aws:iam::<id>:role/<name>
  externalId: string | null;
  regions: string[]; // e.g. ["ap-southeast-1", "us-east-1"]
  services: string[]; // e.g. ["EC2", "RDS", "S3"]
  lastScanAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Scan ────────────────────────────────────────────────────────────────────

export type CfmScanStatus = "pending" | "running" | "completed" | "failed";

export interface CfmScan {
  id: string;
  accountId: string;
  userId: string;
  status: CfmScanStatus;
  summary: CfmScanSummary | null;
  azureConversationId: string | null;
  error: string | null;
  createdAt: Date;
  completedAt: Date | null;
}

export interface CfmScanSummary {
  totalMonthlySpend: number;
  totalPotentialSavings: number;
  recommendationCount: number;
  priorityBreakdown: {
    critical: number;
    medium: number;
    low: number;
  };
  serviceBreakdown: CfmServiceBreakdown[];
}

export interface CfmServiceBreakdown {
  service: string;
  currentSpend: number;
  potentialSavings: number;
  recommendationCount: number;
  resourceCount: number;
  hasCritical: boolean;
  recommendationTypes: string[]; // e.g. ["right-sizing", "unused"]
}

// ─── Recommendation ──────────────────────────────────────────────────────────

export type CfmPriority = "critical" | "medium" | "low";
export type CfmEffort = "low" | "medium" | "high";

export interface CfmRecommendation {
  id: string;
  scanId: string;
  service: string;
  resourceId: string;
  resourceName: string | null;
  priority: CfmPriority;
  recommendation: string;
  currentCost: number;
  estimatedSavings: number;
  effort: CfmEffort;
  metadata: Record<string, unknown>; // service-specific fields
  createdAt: Date;
}

// ─── SSE Progress Events ─────────────────────────────────────────────────────

export type ScanProgressEvent =
  | { type: "service_started"; service: string }
  | { type: "service_collecting"; service: string; detail: string }
  | { type: "data_collected"; resourceCount: number }
  | {
      type: "service_complete";
      service: string;
      summary: string;
      recommendationCount: number;
    }
  | { type: "service_failed"; service: string; error: string }
  | { type: "scan_complete"; summary: CfmScanSummary }
  | { type: "scan_failed"; error: string };

// ─── API Request/Response Shapes ─────────────────────────────────────────────

/** POST /api/cfm/accounts */
export interface CreateAccountRequest {
  accountName: string;
  awsAccountId: string;
  roleArn: string;
  externalId?: string;
  regions: string[];
  services: string[];
}

/** PATCH /api/cfm/accounts/[id] */
export interface UpdateAccountRequest {
  accountName?: string;
  roleArn?: string;
  externalId?: string;
  regions?: string[];
  services?: string[];
}

/** POST /api/cfm/accounts/[id]/test */
export interface TestConnectionResponse {
  success: boolean;
  error?: string;
  accountAlias?: string; // AWS account alias if available
}

/** POST /api/cfm/scans */
export interface StartScanRequest {
  accountId: string;
}

/** POST /api/cfm/export */
export interface ExportRequest {
  scanId: string;
  format: "excel" | "pdf";
}

/** GET /api/cfm/scans/[id]/recommendations */
export interface RecommendationsResponse {
  recommendations: CfmRecommendation[];
  total: number;
}

// ─── Scan History & Trending ────────────────────────────────────────────────

export interface ScanHistoryEntry {
  id: string;
  status: string;
  summary: CfmScanSummary | null;
  createdAt: string;
  completedAt: string | null;
}

export interface TrendDataPoint {
  scanId: string;
  date: string;
  totalMonthlySpend: number;
  totalPotentialSavings: number;
  recommendationCount: number;
}

export interface ScanHistoryResponse {
  scans: ScanHistoryEntry[];
  trend: TrendDataPoint[];
  total: number;
}

// ─── Recommendation Lifecycle ───────────────────────────────────────────────

export type RecommendationLifecycleStatus =
  | "open"
  | "acknowledged"
  | "implemented"
  | "verified";

export interface CfmRecommendationTracking {
  id: string;
  accountId: string;
  resourceId: string;
  service: string;
  status: RecommendationLifecycleStatus;
  firstSeenScanId: string;
  lastSeenScanId: string | null;
  acknowledgedAt: Date | null;
  implementedAt: Date | null;
  verifiedAt: Date | null;
  verifiedScanId: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Valid lifecycle transitions. Terminal: verified has no outgoing transitions. */
export const LIFECYCLE_TRANSITIONS: Record<
  RecommendationLifecycleStatus,
  RecommendationLifecycleStatus[]
> = {
  open: ["acknowledged"],
  acknowledged: ["implemented", "open"],
  implemented: ["verified", "acknowledged"],
  verified: [],
};

/** Enriched recommendation with lifecycle status for display. */
export interface EnrichedRecommendation extends CfmRecommendation {
  lifecycleStatus: RecommendationLifecycleStatus;
  trackingId: string | null;
  acknowledgedAt: Date | null;
  implementedAt: Date | null;
  verifiedAt: Date | null;
  notes: string | null;
}

// ─── Delta Reports ──────────────────────────────────────────────────────────

export type DeltaCategory = "new" | "resolved" | "changed" | "unchanged";

export interface DeltaRecommendation {
  category: DeltaCategory;
  resourceId: string;
  service: string;
  resourceName: string | null;
  current?: CfmRecommendation;
  previous?: CfmRecommendation;
  changes?: {
    priorityChanged: boolean;
    costChanged: boolean;
    savingsChanged: boolean;
    effortChanged: boolean;
    recommendationChanged: boolean;
  };
}

export interface DeltaSummary {
  fromScanId: string;
  toScanId: string;
  fromDate: string;
  toDate: string;
  spendChange: number;
  savingsChange: number;
  newCount: number;
  resolvedCount: number;
  changedCount: number;
  unchangedCount: number;
}

export interface DeltaReport {
  summary: DeltaSummary;
  recommendations: DeltaRecommendation[];
}

// ─── Scheduled Scans ────────────────────────────────────────────────────────

export type ScheduleFrequency = "daily" | "weekly" | "monthly";

export interface CfmSchedule {
  id: string;
  accountId: string;
  userId: string;
  frequency: ScheduleFrequency;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  hour: number;
  enabled: boolean;
  lastRunAt: Date | null;
  nextRunAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
