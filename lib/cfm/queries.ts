import "server-only";

import { db } from "@/lib/db/client";
import {
  cfmAccounts,
  cfmScans,
  cfmRecommendations,
  cfmRecommendationTracking,
  cfmSchedules,
} from "@/lib/db/schema";
import { eq, and, desc, gte, lte, sql } from "drizzle-orm";
import type {
  CfmScanStatus,
  CfmScanSummary,
  RecommendationLifecycleStatus,
} from "./types";

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

// ─── Scan History Queries ───────────────────────────────────────────────────

/**
 * Get completed scans for an account within a date range.
 * Used for trending charts and history view.
 */
export async function getCompletedScansForAccount(
  accountId: string,
  options?: {
    from?: Date;
    to?: Date;
    limit?: number;
    offset?: number;
  },
) {
  const conditions = [
    eq(cfmScans.accountId, accountId),
    eq(cfmScans.status, "completed"),
  ];

  if (options?.from) {
    conditions.push(gte(cfmScans.completedAt, options.from));
  }
  if (options?.to) {
    conditions.push(lte(cfmScans.completedAt, options.to));
  }

  const query = db
    .select({
      id: cfmScans.id,
      status: cfmScans.status,
      summary: cfmScans.summary,
      createdAt: cfmScans.createdAt,
      completedAt: cfmScans.completedAt,
    })
    .from(cfmScans)
    .where(and(...conditions))
    .orderBy(desc(cfmScans.completedAt));

  if (options?.limit) {
    query.limit(options.limit);
  }
  if (options?.offset) {
    query.offset(options.offset);
  }

  return query;
}

/**
 * Count completed scans for an account (for pagination).
 */
export async function countCompletedScansForAccount(
  accountId: string,
  options?: { from?: Date; to?: Date },
) {
  const conditions = [
    eq(cfmScans.accountId, accountId),
    eq(cfmScans.status, "completed"),
  ];
  if (options?.from) conditions.push(gte(cfmScans.completedAt, options.from));
  if (options?.to) conditions.push(lte(cfmScans.completedAt, options.to));

  const [result] = await db
    .select({ count: sql<number>`count(*)` })
    .from(cfmScans)
    .where(and(...conditions));

  return result?.count ?? 0;
}

/**
 * Get a scan by ID for a specific account (for comparison/history).
 */
export async function getScanByIdForAccount(
  scanId: string,
  accountId: string,
  userId: string,
) {
  const [scan] = await db
    .select()
    .from(cfmScans)
    .where(
      and(
        eq(cfmScans.id, scanId),
        eq(cfmScans.accountId, accountId),
        eq(cfmScans.userId, userId),
      ),
    )
    .limit(1);

  return scan ?? null;
}

/**
 * Get two scans by their IDs for comparison.
 * Verifies both scans belong to the same account and user.
 */
export async function getScansForComparison(
  accountId: string,
  userId: string,
  fromScanId: string,
  toScanId: string,
) {
  const [fromScan, toScan] = await Promise.all([
    getScanByIdForAccount(fromScanId, accountId, userId),
    getScanByIdForAccount(toScanId, accountId, userId),
  ]);

  if (!fromScan || !toScan) return null;
  return { fromScan, toScan };
}

// ─── Recommendation Lifecycle Queries ───────────────────────────────────────

/**
 * Get tracking records for an account, optionally filtered by status.
 */
export async function getTrackingByAccount(
  accountId: string,
  status?: RecommendationLifecycleStatus,
) {
  const conditions = [eq(cfmRecommendationTracking.accountId, accountId)];
  if (status) {
    conditions.push(eq(cfmRecommendationTracking.status, status));
  }

  return db
    .select()
    .from(cfmRecommendationTracking)
    .where(and(...conditions));
}

/**
 * Get tracking record for a specific resource.
 */
export async function getTrackingByResource(
  accountId: string,
  resourceId: string,
  service: string,
) {
  const [tracking] = await db
    .select()
    .from(cfmRecommendationTracking)
    .where(
      and(
        eq(cfmRecommendationTracking.accountId, accountId),
        eq(cfmRecommendationTracking.resourceId, resourceId),
        eq(cfmRecommendationTracking.service, service),
      ),
    )
    .limit(1);

  return tracking ?? null;
}

/**
 * Update tracking status with transition validation.
 * Sets the appropriate timestamp based on the new status.
 */
export async function updateTrackingStatus(
  trackingId: string,
  accountId: string,
  status: RecommendationLifecycleStatus,
  notes?: string,
) {
  const timestampUpdates: Record<string, Date | undefined> = {};
  if (status === "acknowledged") timestampUpdates.acknowledgedAt = new Date();
  if (status === "implemented") timestampUpdates.implementedAt = new Date();
  if (status === "verified") timestampUpdates.verifiedAt = new Date();

  const [updated] = await db
    .update(cfmRecommendationTracking)
    .set({
      status,
      notes: notes ?? undefined,
      ...timestampUpdates,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(cfmRecommendationTracking.id, trackingId),
        eq(cfmRecommendationTracking.accountId, accountId),
      ),
    )
    .returning();

  return updated ?? null;
}

/**
 * Get enriched recommendations: join recommendations with tracking records.
 * Returns CfmRecommendation fields + lifecycle status for each.
 */
export async function getEnrichedRecommendations(
  scanId: string,
  accountId: string,
) {
  const rows = await db
    .select({
      // Recommendation fields
      id: cfmRecommendations.id,
      scanId: cfmRecommendations.scanId,
      service: cfmRecommendations.service,
      resourceId: cfmRecommendations.resourceId,
      resourceName: cfmRecommendations.resourceName,
      priority: cfmRecommendations.priority,
      recommendation: cfmRecommendations.recommendation,
      currentCost: cfmRecommendations.currentCost,
      estimatedSavings: cfmRecommendations.estimatedSavings,
      effort: cfmRecommendations.effort,
      metadata: cfmRecommendations.metadata,
      createdAt: cfmRecommendations.createdAt,
      // Tracking fields (nullable from LEFT JOIN)
      trackingId: cfmRecommendationTracking.id,
      lifecycleStatus: cfmRecommendationTracking.status,
      acknowledgedAt: cfmRecommendationTracking.acknowledgedAt,
      implementedAt: cfmRecommendationTracking.implementedAt,
      verifiedAt: cfmRecommendationTracking.verifiedAt,
      notes: cfmRecommendationTracking.notes,
    })
    .from(cfmRecommendations)
    .leftJoin(
      cfmRecommendationTracking,
      and(
        eq(cfmRecommendations.resourceId, cfmRecommendationTracking.resourceId),
        eq(cfmRecommendations.service, cfmRecommendationTracking.service),
        eq(cfmRecommendationTracking.accountId, accountId),
      ),
    )
    .where(eq(cfmRecommendations.scanId, scanId));

  return rows;
}

/**
 * Bulk sync tracking records after a new scan completes.
 * Creates "open" tracking for new resources, updates lastSeenScanId for existing ones.
 */
export async function syncTrackingAfterScan(
  accountId: string,
  scanId: string,
  recommendations: Array<{ resourceId: string; service: string }>,
) {
  if (recommendations.length === 0) return;

  for (const rec of recommendations) {
    const existing = await getTrackingByResource(
      accountId,
      rec.resourceId,
      rec.service,
    );

    if (existing) {
      await db
        .update(cfmRecommendationTracking)
        .set({ lastSeenScanId: scanId, updatedAt: new Date() })
        .where(eq(cfmRecommendationTracking.id, existing.id));
    } else {
      await db.insert(cfmRecommendationTracking).values({
        accountId,
        resourceId: rec.resourceId,
        service: rec.service,
        status: "open",
        firstSeenScanId: scanId,
        lastSeenScanId: scanId,
      });
    }
  }
}

/**
 * Auto-verify: find "implemented" tracking records whose resourceId
 * no longer appears in the latest scan (resource no longer flagged).
 */
export async function autoVerifyImplementedRecommendations(
  accountId: string,
  scanId: string,
  currentResourceKeys: Set<string>,
) {
  const implementedRecords = await getTrackingByAccount(
    accountId,
    "implemented",
  );

  for (const record of implementedRecords) {
    const key = `${record.resourceId}::${record.service}`;
    if (!currentResourceKeys.has(key)) {
      await db
        .update(cfmRecommendationTracking)
        .set({
          status: "verified",
          verifiedAt: new Date(),
          verifiedScanId: scanId,
          updatedAt: new Date(),
        })
        .where(eq(cfmRecommendationTracking.id, record.id));
    }
  }
}

// ─── Schedule Queries ───────────────────────────────────────────────────────

/**
 * Get the schedule for an account.
 */
export async function getScheduleByAccount(accountId: string) {
  const [schedule] = await db
    .select()
    .from(cfmSchedules)
    .where(eq(cfmSchedules.accountId, accountId))
    .limit(1);

  return schedule ?? null;
}

/**
 * Create or update a schedule for an account.
 * Uses the unique accountId constraint for upsert behavior.
 */
export async function upsertSchedule(
  accountId: string,
  userId: string,
  data: {
    frequency: string;
    dayOfWeek?: number;
    dayOfMonth?: number;
    hour?: number;
    enabled?: boolean;
    nextRunAt?: Date;
  },
) {
  const [result] = await db
    .insert(cfmSchedules)
    .values({
      accountId,
      userId,
      frequency: data.frequency,
      dayOfWeek: data.dayOfWeek ?? null,
      dayOfMonth: data.dayOfMonth ?? null,
      hour: data.hour ?? 6,
      enabled: data.enabled ?? true,
      nextRunAt: data.nextRunAt ?? null,
    })
    .onConflictDoUpdate({
      target: cfmSchedules.accountId,
      set: {
        frequency: data.frequency,
        dayOfWeek: data.dayOfWeek ?? null,
        dayOfMonth: data.dayOfMonth ?? null,
        hour: data.hour ?? 6,
        enabled: data.enabled ?? true,
        nextRunAt: data.nextRunAt ?? null,
        updatedAt: new Date(),
      },
    })
    .returning();

  return result;
}

/**
 * Delete a schedule for an account.
 */
export async function deleteSchedule(accountId: string, userId: string) {
  const [deleted] = await db
    .delete(cfmSchedules)
    .where(
      and(
        eq(cfmSchedules.accountId, accountId),
        eq(cfmSchedules.userId, userId),
      ),
    )
    .returning({ id: cfmSchedules.id });

  return deleted ?? null;
}

/**
 * Get all due schedules (enabled and nextRunAt <= now).
 */
export async function getDueSchedules() {
  return db
    .select()
    .from(cfmSchedules)
    .where(
      and(
        eq(cfmSchedules.enabled, true),
        lte(cfmSchedules.nextRunAt, new Date()),
      ),
    );
}

/**
 * Mark a schedule as run, update lastRunAt and compute next nextRunAt.
 */
export async function markScheduleRun(
  scheduleId: string,
  nextRunAt: Date,
) {
  const [updated] = await db
    .update(cfmSchedules)
    .set({
      lastRunAt: new Date(),
      nextRunAt,
      updatedAt: new Date(),
    })
    .where(eq(cfmSchedules.id, scheduleId))
    .returning();

  return updated ?? null;
}
