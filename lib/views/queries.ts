import "server-only";

import { db } from "@/lib/db/client";
import { savedViews } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import type { CreateViewInput, UpdateViewInput } from "./validators";

// ─── Saved Views Queries (Phase 5) ──────────────────────────────────────────

/**
 * Get a single saved view by ID (regardless of owner).
 * Used by PUT/DELETE routes to distinguish 404 from 403.
 */
export async function getViewById(id: string) {
  const [view] = await db
    .select()
    .from(savedViews)
    .where(eq(savedViews.id, id))
    .limit(1);

  return view ?? null;
}

/**
 * List all saved views for a user, optionally filtered by feature.
 * Results are ordered by most recently created first.
 */
export async function getViewsByUser(userId: string, feature?: string) {
  const conditions = feature
    ? and(eq(savedViews.userId, userId), eq(savedViews.feature, feature))
    : eq(savedViews.userId, userId);

  return db
    .select()
    .from(savedViews)
    .where(conditions)
    .orderBy(desc(savedViews.createdAt));
}

/**
 * Create a new saved view for a user. Returns the created view.
 */
export async function createView(userId: string, data: CreateViewInput) {
  const [view] = await db
    .insert(savedViews)
    .values({
      userId,
      name: data.name,
      feature: data.feature,
      filters: data.filters,
      sortBy: data.sortBy ?? null,
      sortOrder: data.sortOrder ?? null,
    })
    .returning();

  return view;
}

/**
 * Update a saved view if owned by the given user.
 * Returns the updated view, or null if not found / not owned.
 */
export async function updateView(
  id: string,
  userId: string,
  data: UpdateViewInput,
) {
  const [updated] = await db
    .update(savedViews)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(savedViews.id, id), eq(savedViews.userId, userId)))
    .returning();

  return updated ?? null;
}

/**
 * Delete a saved view if owned by the given user.
 * Returns true if a row was deleted, false otherwise.
 */
export async function deleteView(id: string, userId: string) {
  const result = await db
    .delete(savedViews)
    .where(and(eq(savedViews.id, id), eq(savedViews.userId, userId)));

  return (result.rowCount ?? 0) > 0;
}
