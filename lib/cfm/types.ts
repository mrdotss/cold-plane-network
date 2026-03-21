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
