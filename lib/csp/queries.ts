import "server-only";

import { db } from "@/lib/db/client";
import {
  awsAccounts,
  cspScans,
  cspFindings,
  cspFindingTracking,
} from "@/lib/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import type {
  CspScanStatus,
  CspScanSummary,
  CspFindingLifecycleStatus,
} from "./types";

// ─── Scan Queries ──────────────────────────────────────────────────────────

export async function createCspScan(accountId: string, userId: string) {
  const [scan] = await db
    .insert(cspScans)
    .values({ accountId, userId, status: "pending" })
    .returning();
  return scan;
}

export async function getCspScanById(scanId: string, userId: string) {
  const [scan] = await db
    .select()
    .from(cspScans)
    .where(and(eq(cspScans.id, scanId), eq(cspScans.userId, userId)))
    .limit(1);
  return scan ?? null;
}

export async function updateCspScanStatus(
  scanId: string,
  status: CspScanStatus,
  summary?: CspScanSummary,
  error?: string,
) {
  const isTerminal = status === "completed" || status === "failed";
  const [updated] = await db
    .update(cspScans)
    .set({
      status,
      summary: summary ?? undefined,
      error: error ?? undefined,
      completedAt: isTerminal ? new Date() : undefined,
    })
    .where(eq(cspScans.id, scanId))
    .returning();
  return updated ?? null;
}

export async function getLatestCspScanForAccount(accountId: string) {
  const [scan] = await db
    .select()
    .from(cspScans)
    .where(eq(cspScans.accountId, accountId))
    .orderBy(desc(cspScans.createdAt))
    .limit(1);
  return scan ?? null;
}

export async function getCompletedCspScansForAccount(
  accountId: string,
  options?: { limit?: number; offset?: number },
) {
  const query = db
    .select({
      id: cspScans.id,
      status: cspScans.status,
      summary: cspScans.summary,
      createdAt: cspScans.createdAt,
      completedAt: cspScans.completedAt,
    })
    .from(cspScans)
    .where(
      and(
        eq(cspScans.accountId, accountId),
        eq(cspScans.status, "completed"),
      ),
    )
    .orderBy(desc(cspScans.completedAt));

  if (options?.limit) query.limit(options.limit);
  if (options?.offset) query.offset(options.offset);
  return query;
}

export async function countCompletedCspScansForAccount(accountId: string) {
  const [result] = await db
    .select({ count: sql<number>`count(*)` })
    .from(cspScans)
    .where(
      and(
        eq(cspScans.accountId, accountId),
        eq(cspScans.status, "completed"),
      ),
    );
  return result?.count ?? 0;
}

// ─── Finding Queries ───────────────────────────────────────────────────────

export async function insertCspFindings(
  findings: Array<{
    scanId: string;
    category: string;
    service: string;
    resourceId: string;
    resourceName?: string;
    severity: string;
    finding: string;
    remediation: string;
    cisReference?: string;
    metadata?: Record<string, unknown>;
  }>,
) {
  if (findings.length === 0) return [];
  return db
    .insert(cspFindings)
    .values(
      findings.map((f) => ({
        scanId: f.scanId,
        category: f.category,
        service: f.service,
        resourceId: f.resourceId,
        resourceName: f.resourceName ?? null,
        severity: f.severity,
        finding: f.finding,
        remediation: f.remediation,
        cisReference: f.cisReference ?? null,
        metadata: f.metadata ?? {},
      })),
    )
    .returning();
}

export async function getCspFindingsByScan(
  scanId: string,
  filters?: { category?: string; severity?: string },
) {
  const conditions = [eq(cspFindings.scanId, scanId)];
  if (filters?.category) {
    conditions.push(eq(cspFindings.category, filters.category));
  }
  if (filters?.severity) {
    conditions.push(eq(cspFindings.severity, filters.severity));
  }
  return db
    .select()
    .from(cspFindings)
    .where(and(...conditions));
}

// ─── Finding Lifecycle Queries ─────────────────────────────────────────────

export async function getCspTrackingByAccount(
  accountId: string,
  status?: CspFindingLifecycleStatus,
) {
  const conditions = [eq(cspFindingTracking.accountId, accountId)];
  if (status) {
    conditions.push(eq(cspFindingTracking.status, status));
  }
  return db
    .select()
    .from(cspFindingTracking)
    .where(and(...conditions));
}

export async function getCspTrackingByResource(
  accountId: string,
  resourceId: string,
  service: string,
) {
  const [tracking] = await db
    .select()
    .from(cspFindingTracking)
    .where(
      and(
        eq(cspFindingTracking.accountId, accountId),
        eq(cspFindingTracking.resourceId, resourceId),
        eq(cspFindingTracking.service, service),
      ),
    )
    .limit(1);
  return tracking ?? null;
}

export async function updateCspTrackingStatus(
  trackingId: string,
  accountId: string,
  status: CspFindingLifecycleStatus,
  notes?: string,
) {
  const timestampUpdates: Record<string, Date | undefined> = {};
  if (status === "acknowledged") timestampUpdates.acknowledgedAt = new Date();
  if (status === "remediated") timestampUpdates.remediatedAt = new Date();

  const [updated] = await db
    .update(cspFindingTracking)
    .set({
      status,
      notes: notes ?? undefined,
      ...timestampUpdates,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(cspFindingTracking.id, trackingId),
        eq(cspFindingTracking.accountId, accountId),
      ),
    )
    .returning();
  return updated ?? null;
}

/**
 * Sync tracking after a CSP scan: create "open" for new findings,
 * update lastSeenScanId for existing ones.
 */
export async function syncCspTrackingAfterScan(
  accountId: string,
  scanId: string,
  findings: Array<{ resourceId: string; service: string; category: string }>,
) {
  if (findings.length === 0) return;

  for (const f of findings) {
    const existing = await getCspTrackingByResource(
      accountId,
      f.resourceId,
      f.service,
    );

    if (existing) {
      await db
        .update(cspFindingTracking)
        .set({ lastSeenScanId: scanId, updatedAt: new Date() })
        .where(eq(cspFindingTracking.id, existing.id));
    } else {
      await db.insert(cspFindingTracking).values({
        accountId,
        resourceId: f.resourceId,
        service: f.service,
        category: f.category,
        status: "open",
        firstSeenScanId: scanId,
        lastSeenScanId: scanId,
      });
    }
  }
}

/**
 * Get enriched findings: join findings with tracking records.
 */
export async function getEnrichedCspFindings(
  scanId: string,
  accountId: string,
  filters?: { category?: string; severity?: string },
) {
  const conditions = [eq(cspFindings.scanId, scanId)];
  if (filters?.category) {
    conditions.push(eq(cspFindings.category, filters.category));
  }
  if (filters?.severity) {
    conditions.push(eq(cspFindings.severity, filters.severity));
  }

  return db
    .select({
      id: cspFindings.id,
      scanId: cspFindings.scanId,
      category: cspFindings.category,
      service: cspFindings.service,
      resourceId: cspFindings.resourceId,
      resourceName: cspFindings.resourceName,
      severity: cspFindings.severity,
      finding: cspFindings.finding,
      remediation: cspFindings.remediation,
      cisReference: cspFindings.cisReference,
      metadata: cspFindings.metadata,
      createdAt: cspFindings.createdAt,
      trackingId: cspFindingTracking.id,
      lifecycleStatus: cspFindingTracking.status,
      acknowledgedAt: cspFindingTracking.acknowledgedAt,
      remediatedAt: cspFindingTracking.remediatedAt,
      notes: cspFindingTracking.notes,
    })
    .from(cspFindings)
    .leftJoin(
      cspFindingTracking,
      and(
        eq(cspFindings.resourceId, cspFindingTracking.resourceId),
        eq(cspFindings.service, cspFindingTracking.service),
        eq(cspFindingTracking.accountId, accountId),
      ),
    )
    .where(and(...conditions));
}
