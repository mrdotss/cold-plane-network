// ─── CSP Categories & Severity ──────────────────────────────────────────────

export type CspCategory =
  | "identity_access"
  | "network"
  | "data_protection"
  | "logging"
  | "external_access";

export type CspSeverity = "critical" | "high" | "medium" | "low";

export const CSP_CATEGORIES: { id: CspCategory; label: string }[] = [
  { id: "identity_access", label: "Identity & Access" },
  { id: "network", label: "Network Security" },
  { id: "data_protection", label: "Data Protection" },
  { id: "logging", label: "Logging & Monitoring" },
  { id: "external_access", label: "External Access" },
];

// ─── Scan ───────────────────────────────────────────────────────────────────

export type CspScanStatus = "pending" | "running" | "completed" | "failed";

export interface CspScanSummary {
  totalFindings: number;
  severityBreakdown: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  categoryBreakdown: Record<CspCategory, number>;
  securityScore: number; // 0-100, higher is better
}

// ─── Finding ────────────────────────────────────────────────────────────────

export interface CspFinding {
  id: string;
  scanId: string;
  category: CspCategory;
  service: string;
  resourceId: string;
  resourceName: string | null;
  severity: CspSeverity;
  finding: string;
  remediation: string;
  cisReference: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface CspFindingInput {
  category: CspCategory;
  service: string;
  resourceId: string;
  resourceName?: string;
  severity: CspSeverity;
  finding: string;
  remediation: string;
  cisReference?: string;
  metadata?: Record<string, unknown>;
}

// ─── SSE Progress Events ────────────────────────────────────────────────────

export type CspScanProgressEvent =
  | { type: "category_started"; category: CspCategory }
  | { type: "category_collecting"; category: CspCategory; detail: string }
  | { type: "data_collected"; checkCount: number }
  | {
      type: "category_complete";
      category: CspCategory;
      findingCount: number;
    }
  | { type: "category_failed"; category: CspCategory; error: string }
  | { type: "scan_complete"; summary: CspScanSummary }
  | { type: "scan_failed"; error: string };

// ─── Finding Lifecycle ──────────────────────────────────────────────────────

export type CspFindingLifecycleStatus = "open" | "acknowledged" | "remediated";

// ─── API Shapes ─────────────────────────────────────────────────────────────

export interface StartCspScanRequest {
  accountId: string;
}
