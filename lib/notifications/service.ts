import "server-only";

import { db } from "@/lib/db/client";
import { notifications } from "@/lib/db/schema";
import { writeAuditEvent } from "@/lib/audit/writer";
import { eq, and, sql, desc, isNull, inArray } from "drizzle-orm";
import type {
  NotificationType,
  NotificationMetadata,
  NotificationListOptions,
  NotificationListResponse,
  NotificationRecord,
} from "./types";
import { NOTIFICATION_TYPES } from "./types";

export const MAX_METADATA_BYTES = 1024;

/**
 * Validate that metadata serialized size is within the 1 KB limit.
 * Exported for property-based testing.
 */
export function validateMetadataSize(metadata: NotificationMetadata): void {
  const serialized = JSON.stringify(metadata);
  const byteLength = new TextEncoder().encode(serialized).byteLength;
  if (byteLength > MAX_METADATA_BYTES) {
    throw new Error(
      `Metadata exceeds maximum size of ${MAX_METADATA_BYTES} bytes (got ${byteLength} bytes)`,
    );
  }
}

/**
 * Validate that the notification type is one of the allowed types.
 */
function validateType(type: string): asserts type is NotificationType {
  if (!NOTIFICATION_TYPES.includes(type as NotificationType)) {
    throw new Error(`Invalid notification type: ${type}`);
  }
}

/**
 * Create a new notification for a user.
 * Validates metadata size ≤ 1024 bytes and type is a known NotificationType.
 */
export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  body: string,
  metadata: NotificationMetadata,
): Promise<string> {
  validateType(type);
  validateMetadataSize(metadata);

  const [row] = await db
    .insert(notifications)
    .values({
      userId,
      type,
      title,
      body,
      metadata,
    })
    .returning({ id: notifications.id });

  return row.id;
}

/**
 * List notifications for a user with pagination and optional unread filter.
 * Returns notifications, unreadCount, and total.
 */
export async function listNotifications(
  userId: string,
  options: NotificationListOptions = {},
): Promise<NotificationListResponse> {
  const { page = 1, limit = 20, unreadOnly = false } = options;
  const offset = (page - 1) * limit;

  const baseCondition = eq(notifications.userId, userId);
  const filterCondition = unreadOnly
    ? and(baseCondition, isNull(notifications.readAt))
    : baseCondition;

  const [rows, [countRow], [unreadRow]] = await Promise.all([
    db
      .select()
      .from(notifications)
      .where(filterCondition)
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(filterCondition),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(baseCondition, isNull(notifications.readAt))),
  ]);

  return {
    notifications: rows.map(toNotificationRecord),
    total: countRow.count,
    unreadCount: unreadRow.count,
  };
}

/**
 * Mark notifications as read for a specific user.
 * Only affects notifications owned by the user.
 */
export async function markAsRead(
  userId: string,
  ids: string[],
): Promise<number> {
  if (ids.length === 0) return 0;

  const result = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(eq(notifications.userId, userId), inArray(notifications.id, ids)),
    );

  return result.rowCount ?? 0;
}

/**
 * Dismiss (delete) notifications for a specific user.
 * Only affects notifications owned by the user.
 * Logs NOTIFICATION_DISMISSED audit events for each deleted notification.
 */
export async function dismissNotifications(
  userId: string,
  ids: string[],
): Promise<number> {
  if (ids.length === 0) return 0;

  // First find which IDs actually belong to this user
  const owned = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(
      and(eq(notifications.userId, userId), inArray(notifications.id, ids)),
    );

  if (owned.length === 0) return 0;

  const ownedIds = owned.map((r) => r.id);

  const result = await db
    .delete(notifications)
    .where(inArray(notifications.id, ownedIds));

  // Log audit events for each dismissed notification
  await Promise.all(
    ownedIds.map((notificationId) =>
      writeAuditEvent({
        userId,
        eventType: "NOTIFICATION_DISMISSED",
        metadata: { notificationId },
      }),
    ),
  );

  return result.rowCount ?? 0;
}

/**
 * Get the unread notification count for a user.
 * Lightweight count-only query for polling.
 */
export async function getUnreadCount(userId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notifications)
    .where(
      and(eq(notifications.userId, userId), isNull(notifications.readAt)),
    );

  return row.count;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toNotificationRecord(
  row: typeof notifications.$inferSelect,
): NotificationRecord {
  return {
    id: row.id,
    userId: row.userId,
    type: row.type as NotificationType,
    title: row.title,
    body: row.body,
    metadata: row.metadata as NotificationMetadata,
    readAt: row.readAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}
