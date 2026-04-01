import "server-only";

import { db } from "@/lib/db/client";
import { awsBudgets, awsAccounts, cfmScans } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import type { CfmScanSummary } from "./types";

/**
 * List all budgets for a user.
 */
export async function getBudgetsByUser(userId: string) {
  return db.select().from(awsBudgets).where(eq(awsBudgets.userId, userId));
}

/**
 * Get a single budget by ID, scoped to user.
 */
export async function getBudgetById(budgetId: string, userId: string) {
  const [budget] = await db
    .select()
    .from(awsBudgets)
    .where(and(eq(awsBudgets.id, budgetId), eq(awsBudgets.userId, userId)))
    .limit(1);

  return budget ?? null;
}

/**
 * Create a new budget.
 */
export async function createBudget(
  userId: string,
  data: {
    name: string;
    accountId?: string;
    groupId?: string;
    monthlyLimit: number;
    alertThresholdPct?: number;
    enabled?: boolean;
  },
) {
  const [budget] = await db
    .insert(awsBudgets)
    .values({
      userId,
      name: data.name,
      accountId: data.accountId ?? null,
      groupId: data.groupId ?? null,
      monthlyLimit: data.monthlyLimit.toFixed(2),
      alertThresholdPct: data.alertThresholdPct ?? 80,
      enabled: data.enabled ?? true,
    })
    .returning();

  return budget;
}

/**
 * Update a budget.
 */
export async function updateBudget(
  budgetId: string,
  userId: string,
  data: {
    name?: string;
    monthlyLimit?: number;
    alertThresholdPct?: number;
    enabled?: boolean;
  },
) {
  const setData: Record<string, unknown> = { updatedAt: new Date() };
  if (data.name !== undefined) setData.name = data.name;
  if (data.monthlyLimit !== undefined) setData.monthlyLimit = data.monthlyLimit.toFixed(2);
  if (data.alertThresholdPct !== undefined) setData.alertThresholdPct = data.alertThresholdPct;
  if (data.enabled !== undefined) setData.enabled = data.enabled;

  const [updated] = await db
    .update(awsBudgets)
    .set(setData)
    .where(and(eq(awsBudgets.id, budgetId), eq(awsBudgets.userId, userId)))
    .returning();

  return updated ?? null;
}

/**
 * Delete a budget.
 */
export async function deleteBudget(budgetId: string, userId: string) {
  const [deleted] = await db
    .delete(awsBudgets)
    .where(and(eq(awsBudgets.id, budgetId), eq(awsBudgets.userId, userId)))
    .returning({ id: awsBudgets.id });

  return deleted ?? null;
}

/**
 * Get budget utilization for all budgets for a user.
 * Computes current spend from latest scan summaries.
 */
export async function getBudgetsWithUtilization(userId: string) {
  const budgets = await getBudgetsByUser(userId);
  if (budgets.length === 0) return [];

  // Get all accounts with their latest scan summaries
  const accounts = await db.select().from(awsAccounts).where(eq(awsAccounts.userId, userId));

  const accountSpendMap = new Map<string, number>();
  for (const account of accounts) {
    const [latestScan] = await db
      .select({ summary: cfmScans.summary })
      .from(cfmScans)
      .where(and(eq(cfmScans.accountId, account.id), eq(cfmScans.status, "completed")))
      .orderBy(desc(cfmScans.completedAt))
      .limit(1);

    const summary = latestScan?.summary as CfmScanSummary | null;
    accountSpendMap.set(account.id, summary?.totalMonthlySpend ?? 0);
  }

  // Group accounts by groupId for group-level budgets
  const groupSpendMap = new Map<string, number>();
  for (const account of accounts) {
    const groupId = account.groupId as string | null;
    if (groupId) {
      const current = groupSpendMap.get(groupId) ?? 0;
      groupSpendMap.set(groupId, current + (accountSpendMap.get(account.id) ?? 0));
    }
  }

  return budgets.map((budget) => {
    let currentSpend = 0;
    if (budget.accountId) {
      currentSpend = accountSpendMap.get(budget.accountId) ?? 0;
    } else if (budget.groupId) {
      currentSpend = groupSpendMap.get(budget.groupId) ?? 0;
    }

    const monthlyLimit = Number(budget.monthlyLimit);
    const utilizationPct = monthlyLimit > 0 ? Math.round((currentSpend / monthlyLimit) * 100) : 0;
    const isOverThreshold = utilizationPct >= budget.alertThresholdPct;

    return {
      ...budget,
      currentSpend,
      utilizationPct,
      isOverThreshold,
    };
  });
}
