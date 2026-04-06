// ─── Notification Types (Phase 4) ────────────────────────────────────────────

export type NotificationType =
  | "cfm_scan_complete"
  | "csp_scan_complete"
  | "digest_summary"
  | "correlation_alert"
  | "savings_verified"
  | "security_regression";

export const NOTIFICATION_TYPES: readonly NotificationType[] = [
  "cfm_scan_complete",
  "csp_scan_complete",
  "digest_summary",
  "correlation_alert",
  "savings_verified",
  "security_regression",
] as const;

// ─── Discriminated Metadata Unions ───────────────────────────────────────────

export interface CfmScanCompleteMetadata {
  scanId: string;
  accountId: string;
  totalSavings: number;
  recommendationCount: number;
}

export interface CspScanCompleteMetadata {
  scanId: string;
  accountId: string;
  securityScore: number;
  critical: number;
  high: number;
}

export interface DigestSummaryMetadata {
  periodStart: string;
  periodEnd: string;
  spendDelta: number;
  newFindings: number;
  scoreChange: number;
}

export interface CorrelationAlertMetadata {
  resourceId: string;
  accountId: string;
  severity: string;
  estimatedSavings: number;
}

export interface SavingsVerifiedMetadata {
  resourceId: string;
  expectedSavings: number;
  actualSavings: number;
}

export interface SecurityRegressionMetadata {
  accountId: string;
  previousScore: number;
  currentScore: number;
  newCritical: number;
}

export type NotificationMetadata =
  | CfmScanCompleteMetadata
  | CspScanCompleteMetadata
  | DigestSummaryMetadata
  | CorrelationAlertMetadata
  | SavingsVerifiedMetadata
  | SecurityRegressionMetadata;

// ─── API Types ───────────────────────────────────────────────────────────────

export interface NotificationRecord {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  metadata: NotificationMetadata;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationListOptions {
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
}

export interface NotificationListResponse {
  notifications: NotificationRecord[];
  unreadCount: number;
  total: number;
}
