import "server-only";

import { db } from "@/lib/db/client";
import { annotations } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import type {
  CreateAnnotationInput,
  UpdateAnnotationInput,
} from "./validators";

// ─── Annotations Queries (Phase 5) ──────────────────────────────────────────

/**
 * Get a single annotation by ID (regardless of owner).
 * Used by PUT/DELETE routes to distinguish 404 from 403.
 */
export async function getAnnotationById(id: string) {
  const [annotation] = await db
    .select()
    .from(annotations)
    .where(eq(annotations.id, id))
    .limit(1);

  return annotation ?? null;
}

/**
 * List all annotations for a user + target combination.
 * Results are ordered by most recently created first.
 * Validates: Requirement 8.1
 */
export async function getAnnotations(
  userId: string,
  targetType: string,
  targetId: string,
) {
  return db
    .select()
    .from(annotations)
    .where(
      and(
        eq(annotations.userId, userId),
        eq(annotations.targetType, targetType),
        eq(annotations.targetId, targetId),
      ),
    )
    .orderBy(desc(annotations.createdAt));
}

/**
 * Create a new annotation for a user. Returns the created annotation.
 * Validates: Requirement 8.2
 */
export async function createAnnotation(
  userId: string,
  data: CreateAnnotationInput,
) {
  const [annotation] = await db
    .insert(annotations)
    .values({
      userId,
      targetType: data.targetType,
      targetId: data.targetId,
      content: data.content,
    })
    .returning();

  return annotation;
}

/**
 * Update an annotation if owned by the given user.
 * Returns the updated annotation, or null if not found / not owned.
 * Validates: Requirement 8.4
 */
export async function updateAnnotation(
  id: string,
  userId: string,
  data: UpdateAnnotationInput,
) {
  const [updated] = await db
    .update(annotations)
    .set({ content: data.content, updatedAt: new Date() })
    .where(and(eq(annotations.id, id), eq(annotations.userId, userId)))
    .returning();

  return updated ?? null;
}

/**
 * Delete an annotation if owned by the given user.
 * Returns true if a row was deleted, false otherwise.
 * Validates: Requirement 8.5
 */
export async function deleteAnnotation(id: string, userId: string) {
  const result = await db
    .delete(annotations)
    .where(and(eq(annotations.id, id), eq(annotations.userId, userId)));

  return (result.rowCount ?? 0) > 0;
}
