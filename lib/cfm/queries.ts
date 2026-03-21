import "server-only";

import { db } from "@/lib/db/client";
import { cfmAccounts, cfmScans, cfmRecommendations } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import type { CfmScanStatus, CfmScanSummary } from "./types";

// ─── Account Queries ─────────────────────────────────────────────────────────

/**
 * Create a new CFM account connection for a user.
 */
export async function createAccount(
  userId: string,
  data: {
    accountName: string;
    awsAccountId: string;
    roleArn: string;
    externalId?: string;
    regions: string[];
    services: string[];
  },
) {
  const [account] = await db
    .insert(cfmAccounts)
    .values({
      userId,
      accountName: data.accountName,
      awsAccountId: data.awsAccountId,
      roleArn: data.roleArn,
      externalId: data.externalId ?? null,
      regions: data.regions,
      services: data.services,
    })
    .returning();

  return account;
}

/**
 * List all CFM accounts for a user.
 */
export async function getAccountsByUser(userId: string) {
  return db
    .select()
    .from(cfmAccounts)
    .where(eq(cfmAccounts.userId, userId));
}


/**
 * Get a single CFM account by ID, scoped to the authenticated user.
 */
export async function getAccountById(accountId: string, userId: string) {
  const [account] = await db
    .select()
    .from(cfmAccounts)
    .where(and(eq(cfmAccounts.id, accountId), eq(cfmAccounts.userId, userId)))
    .limit(1);

  return account ?? null;
}

/**
 * Update a CFM account's fields, scoped to the authenticated user.
 */
export async function updateAccount(
  accountId: string,
  userId: string,
  data: {
    accountName?: string;
    roleArn?: string;
    externalId?: string;
    regions?: string[];
    services?: string[];
  },
) {
  const [updated] = await db
    .update(cfmAccounts)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(cfmAccounts.id, accountId), eq(cfmAccounts.userId, userId)))
    .returning();

  return updated ?? null;
}

/**
 * Delete a CFM account (cascade deletes scans + recommendations), scoped to the authenticated user.
 */
export async function deleteAccount(accountId: string, userId: string) {
  const [deleted] = await db
    .delete(cfmAccounts)
    .where(and(eq(cfmAccounts.id, accountId), eq(cfmAccounts.userId, userId)))
    .returning({ id: cfmAccounts.id });

  return deleted ?? null;
}

// ─── Scan Queries ────────────────────────────────────────────────────────────

/**
 * Create a new scan record with status "pending".
 */
export async function createScan(accountId: string, userId: string) {
  const [scan] = await db
    .insert(cfmScans)
    .values({
      accountId,
      userId,
      status: "pending",
    })
    .returning();

  return scan;
}

/**
 * Get a scan by ID, scoped to the authenticated user.
 */
export async function getScanById(scanId: string, userId: string) {
  const [scan] = await db
    .select()
    .from(cfmScans)
    .where(and(eq(cfmScans.id, scanId), eq(cfmScans.userId, userId)))
    .limit(1);

  return scan ?? null;
}

/**
 * Update scan status, summary, error, and completedAt (if terminal).
 */
export async function updateScanStatus(
  scanId: string,
  status: CfmScanStatus,
  summary?: CfmScanSummary,
  error?: string,
) {
  const isTerminal = status === "completed" || status === "failed";

  const [updated] = await db
    .update(cfmScans)
    .set({
      status,
      summary: summary ?? undefined,
      error: error ?? undefined,
      completedAt: isTerminal ? new Date() : undefined,
    })
    .where(eq(cfmScans.id, scanId))
    .returning();

  return updated ?? null;
}

/**
 * Get the most recent scan for an account (order by createdAt desc, limit 1).
 */
export async function getLatestScanForAccount(accountId: string) {
  const [scan] = await db
    .select()
    .from(cfmScans)
    .where(eq(cfmScans.accountId, accountId))
    .orderBy(desc(cfmScans.createdAt))
    .limit(1);

  return scan ?? null;
}

// ─── Recommendation Queries ──────────────────────────────────────────────────

/**
 * Bulk insert recommendations for a scan.
 */
export async function insertRecommendations(
  recommendations: {
    scanId: string;
    service: string;
    resourceId: string;
    resourceName?: string;
    priority: string;
    recommendation: string;
    currentCost: string;
    estimatedSavings: string;
    effort: string;
    metadata?: Record<string, unknown>;
  }[],
) {
  if (recommendations.length === 0) return [];

  return db
    .insert(cfmRecommendations)
    .values(
      recommendations.map((r) => ({
        scanId: r.scanId,
        service: r.service,
        resourceId: r.resourceId,
        resourceName: r.resourceName ?? null,
        priority: r.priority,
        recommendation: r.recommendation,
        currentCost: r.currentCost,
        estimatedSavings: r.estimatedSavings,
        effort: r.effort,
        metadata: r.metadata ?? {},
      })),
    )
    .returning();
}

/**
 * Get all recommendations for a scan.
 */
export async function getRecommendationsByScan(scanId: string) {
  return db
    .select()
    .from(cfmRecommendations)
    .where(eq(cfmRecommendations.scanId, scanId));
}

/**
 * Get recommendations for a scan filtered by service.
 */
export async function getRecommendationsByService(
  scanId: string,
  service: string,
) {
  return db
    .select()
    .from(cfmRecommendations)
    .where(
      and(
        eq(cfmRecommendations.scanId, scanId),
        eq(cfmRecommendations.service, service),
      ),
    );
}
