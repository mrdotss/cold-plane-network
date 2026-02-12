import "server-only";

import { prisma } from "@/lib/db/client";
import { type AuditEventInput, isValidEventType } from "./events";
import { redactMetadata } from "./redact";

/**
 * Persist an audit event to the database.
 * Metadata is redacted before write. Invalid event types are rejected.
 */
export async function writeAuditEvent(input: AuditEventInput): Promise<void> {
  if (!isValidEventType(input.eventType)) {
    throw new Error(`Invalid audit event type: ${input.eventType}`);
  }

  const metadata = redactMetadata(input.eventType, input.metadata);

  await prisma.auditEvent.create({
    data: {
      userId: input.userId,
      eventType: input.eventType,
      metadata,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    },
  });
}
