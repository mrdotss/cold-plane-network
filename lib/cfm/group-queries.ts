import "server-only";

import { db } from "@/lib/db/client";
import { awsAccountGroups, awsAccounts } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

/**
 * List all groups for a user.
 */
export async function getGroupsByUser(userId: string) {
  return db
    .select()
    .from(awsAccountGroups)
    .where(eq(awsAccountGroups.userId, userId));
}

/**
 * Get a single group by ID, scoped to user.
 */
export async function getGroupById(groupId: string, userId: string) {
  const [group] = await db
    .select()
    .from(awsAccountGroups)
    .where(
      and(eq(awsAccountGroups.id, groupId), eq(awsAccountGroups.userId, userId)),
    )
    .limit(1);

  return group ?? null;
}

/**
 * Create a new account group.
 */
export async function createGroup(
  userId: string,
  data: { name: string; description?: string; color?: string },
) {
  const [group] = await db
    .insert(awsAccountGroups)
    .values({
      userId,
      name: data.name,
      description: data.description ?? null,
      color: data.color ?? null,
    })
    .returning();

  return group;
}

/**
 * Update a group's fields.
 */
export async function updateGroup(
  groupId: string,
  userId: string,
  data: { name?: string; description?: string; color?: string },
) {
  const [updated] = await db
    .update(awsAccountGroups)
    .set({ ...data, updatedAt: new Date() })
    .where(
      and(eq(awsAccountGroups.id, groupId), eq(awsAccountGroups.userId, userId)),
    )
    .returning();

  return updated ?? null;
}

/**
 * Delete a group. Accounts with this groupId will have it set to null (ON DELETE SET NULL).
 */
export async function deleteGroup(groupId: string, userId: string) {
  const [deleted] = await db
    .delete(awsAccountGroups)
    .where(
      and(eq(awsAccountGroups.id, groupId), eq(awsAccountGroups.userId, userId)),
    )
    .returning({ id: awsAccountGroups.id });

  return deleted ?? null;
}

/**
 * Assign an account to a group (or unassign by passing null).
 */
export async function assignAccountToGroup(
  accountId: string,
  userId: string,
  groupId: string | null,
) {
  const [updated] = await db
    .update(awsAccounts)
    .set({ groupId, updatedAt: new Date() })
    .where(
      and(eq(awsAccounts.id, accountId), eq(awsAccounts.userId, userId)),
    )
    .returning();

  return updated ?? null;
}
