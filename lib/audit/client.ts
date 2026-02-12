/**
 * Client-safe audit logging. Calls POST /api/audit via fetch.
 * This module is safe to import in client components.
 */

import type { AuditEventType } from "./events";

/**
 * Log an audit event from the client side.
 * Fire-and-forget — errors are caught and logged to console.
 */
export async function logAuditEvent(
  eventType: AuditEventType,
  metadata: Record<string, unknown>
): Promise<void> {
  try {
    await fetch("/api/audit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventType, metadata }),
    });
  } catch (err) {
    console.error("Failed to log audit event:", err);
  }
}
