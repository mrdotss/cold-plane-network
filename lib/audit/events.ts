/**
 * Audit event type taxonomy and per-event metadata allowlists.
 *
 * All audit events use a CATEGORY_ACTION naming convention.
 * Metadata allowlists define which fields are permitted for each event type.
 */

export const AUDIT_EVENT_TYPES = [
  "AUTH_REGISTER",
  "AUTH_LOGIN_SUCCESS",
  "AUTH_LOGIN_FAILURE",
  "AUTH_LOGOUT",
  "STUDIO_VALIDATE",
  "STUDIO_GENERATE_ARTIFACTS",
  "STUDIO_DOWNLOAD_ZIP",
  "STUDIO_COPY_SHARE_LINK",
  "MIGRATION_PROJECT_CREATE",
  "MIGRATION_PROJECT_DELETE",
  "MIGRATION_RESOURCE_IMPORT",
  "MIGRATION_MAPPING_RUN",
  "MIGRATION_REPORT_EXPORT",
  "SIZING_UPLOAD",
  "SIZING_GENERATE_REPORT",
  "SIZING_AGENT_RECOMMEND",
  "SIZING_DOWNLOAD_EXCEL",
  "SIZING_AGENT_AUTOFILL",
  "CHAT_CREATED",
  "CHAT_MESSAGE_SENT",
  "CHAT_DELETED",
  "CHAT_FILE_UPLOADED",
  "CFM_ACCOUNT_CONNECTED",
  "CFM_ACCOUNT_DELETED",
  "CFM_SCAN_STARTED",
  "CFM_SCAN_COMPLETED",
  "CFM_REPORT_EXPORTED",
] as const;

export type AuditEventType = (typeof AUDIT_EVENT_TYPES)[number];

/**
 * Per-event metadata allowlists.
 * Only fields listed here are permitted in the metadata for each event type.
 * Any field not on the allowlist is stripped before persistence.
 */
export const METADATA_ALLOWLISTS: Record<AuditEventType, readonly string[]> = {
  AUTH_REGISTER: ["username"],
  AUTH_LOGIN_SUCCESS: ["username"],
  AUTH_LOGIN_FAILURE: ["username", "reason"],
  AUTH_LOGOUT: [],
  STUDIO_VALIDATE: ["resourceCount", "errorCount"],
  STUDIO_GENERATE_ARTIFACTS: ["artifactTypes", "resourceCount"],
  STUDIO_DOWNLOAD_ZIP: ["artifactCount", "totalSizeBytes"],
  STUDIO_COPY_SHARE_LINK: ["linkId"],
  MIGRATION_PROJECT_CREATE: ["projectName"],
  MIGRATION_PROJECT_DELETE: ["projectName"],
  MIGRATION_RESOURCE_IMPORT: ["projectId", "resourceCount"],
  MIGRATION_MAPPING_RUN: ["projectId", "resourceCount"],
  MIGRATION_REPORT_EXPORT: ["projectId", "format"],
  SIZING_UPLOAD: ["fileName", "serviceCount", "reportType"],
  SIZING_GENERATE_REPORT: ["reportType", "serviceCount", "totalMonthly"],
  SIZING_AGENT_RECOMMEND: ["reportType", "serviceCount", "promptLength"],
  SIZING_DOWNLOAD_EXCEL: ["reportId", "reportType"],
  SIZING_AGENT_AUTOFILL: ["reportType", "serviceCount", "inputTier", "filledTiers"],
  CHAT_CREATED: ["chatId"],
  CHAT_MESSAGE_SENT: ["chatId", "hasAttachments", "attachmentTypes"],
  CHAT_DELETED: ["chatId"],
  CHAT_FILE_UPLOADED: ["fileType", "fileSize"],
  CFM_ACCOUNT_CONNECTED: ["accountId", "awsAccountId"],
  CFM_ACCOUNT_DELETED: ["accountId"],
  CFM_SCAN_STARTED: ["scanId", "accountId", "services", "regions"],
  CFM_SCAN_COMPLETED: ["scanId", "totalSavings", "recommendationCount"],
  CFM_REPORT_EXPORTED: ["scanId", "format"],
} as const;

export interface AuditEventInput {
  userId: string;
  eventType: AuditEventType;
  metadata: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Type guard to check if a string is a valid AuditEventType.
 */
export function isValidEventType(value: string): value is AuditEventType {
  return (AUDIT_EVENT_TYPES as readonly string[]).includes(value);
}
