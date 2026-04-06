import "server-only";

import { db } from "@/lib/db/client";
import {
  cfmScans,
  cfmRecommendations,
  cspScans,
  cspFindings,
  notifications,
} from "@/lib/db/schema";
import { eq, and, desc, sql, gte } from "drizzle-orm";
import { createNotification } from "@/lib/notifications/service";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CorrelatedResource {
  resourceId: string;
  resourceName: string;
  service: string;
  cfmRecommendation: {
    priority: string;
    currentCost: number;
    estimatedSavings: number;
  };
  cspFindings: Array<{
    severity: string;
    finding: string;
    cisReference: string | null;
    category: string;
  }>;
}

export interface CorrelationResponse {
  correlations: CorrelatedResource[];
}

// ─── Resource ID Normalization ───────────────────────────────────────────────

/**
 * SQL expression to normalize CSP prefixed resource IDs.
 * Extracts the second colon-delimited segment, or returns the full string
 * if no colon is present.
 *
 * Examples:
 *   'sg:sg-123:22'              → 'sg-123'
 *   's3:bucket-name:encryption' → 'bucket-name'
 *   'user:admin'                → 'admin'
 *   'root-account'              → 'root-account'
 *
 * Exported for property-based testing.
 */
export function normalizeResourceIdSql(column: ReturnType<typeof sql>) {
  return sql`CASE WHEN position(':' in ${column}) > 0 THEN SPLIT_PART(${column}, ':', 2) ELSE ${column} END`;
}

/**
 * Pure function to normalize a CSP resource ID string.
 * Mirrors the SQL CASE WHEN / SPLIT_PART logic for use in tests and JS code.
 * Exported for property-based testing.
 */
export function normalizeResourceId(cspResourceId: string): string {
  const colonIndex = cspResourceId.indexOf(":");
  if (colonIndex < 0) return cspResourceId;
  const secondSegment = cspResourceId.split(":")[1];
  return secondSegment ?? cspResourceId;
}

// ─── Correlation Engine ──────────────────────────────────────────────────────

/**
 * Find cross-domain correlations between CFM recommendations and CSP findings
 * for a given account. Joins on normalized resource ID at query time.
 */
export async function findCorrelations(
  accountId: string,
  userId: string,
): Promise<CorrelatedResource[]> {
  // 1. Get latest completed CFM scan for this account
  const [latestCfmScan] = await db
    .select({ id: cfmScans.id })
    .from(cfmScans)
    .where(
      and(
        eq(cfmScans.accountId, accountId),
        eq(cfmScans.userId, userId),
        eq(cfmScans.status, "completed"),
      ),
    )
    .orderBy(desc(cfmScans.completedAt))
    .limit(1);

  if (!latestCfmScan) return [];

  // 2. Get latest completed CSP scan for this account
  const [latestCspScan] = await db
    .select({ id: cspScans.id })
    .from(cspScans)
    .where(
      and(
        eq(cspScans.accountId, accountId),
        eq(cspScans.userId, userId),
        eq(cspScans.status, "completed"),
      ),
    )
    .orderBy(desc(cspScans.completedAt))
    .limit(1);

  if (!latestCspScan) return [];

  // 3. Get CFM recommendations
  const recs = await db
    .select({
      resourceId: cfmRecommendations.resourceId,
      resourceName: cfmRecommendations.resourceName,
      service: cfmRecommendations.service,
      priority: cfmRecommendations.priority,
      currentCost: cfmRecommendations.currentCost,
      estimatedSavings: cfmRecommendations.estimatedSavings,
    })
    .from(cfmRecommendations)
    .where(eq(cfmRecommendations.scanId, latestCfmScan.id));

  if (recs.length === 0) return [];

  // 4. Get CSP findings with normalized resource IDs
  const findings = await db
    .select({
      rawResourceId: sql<string>`CASE WHEN position(':' in ${cspFindings.resourceId}) > 0 THEN SPLIT_PART(${cspFindings.resourceId}, ':', 2) ELSE ${cspFindings.resourceId} END`,
      severity: cspFindings.severity,
      finding: cspFindings.finding,
      cisReference: cspFindings.cisReference,
      category: cspFindings.category,
    })
    .from(cspFindings)
    .where(eq(cspFindings.scanId, latestCspScan.id));

  if (findings.length === 0) return [];

  // 5. Build a map of CSP findings by normalized resource ID
  const findingsByResource = new Map<
    string,
    Array<{ severity: string; finding: string; cisReference: string | null; category: string }>
  >();
  for (const f of findings) {
    const key = f.rawResourceId;
    if (!findingsByResource.has(key)) {
      findingsByResource.set(key, []);
    }
    findingsByResource.get(key)!.push({
      severity: f.severity,
      finding: f.finding,
      cisReference: f.cisReference,
      category: f.category,
    });
  }

  // 6. Join: find CFM recommendations that have matching CSP findings
  const correlations: CorrelatedResource[] = [];
  for (const rec of recs) {
    const matchedFindings = findingsByResource.get(rec.resourceId);
    if (matchedFindings && matchedFindings.length > 0) {
      correlations.push({
        resourceId: rec.resourceId,
        resourceName: rec.resourceName ?? rec.resourceId,
        service: rec.service,
        cfmRecommendation: {
          priority: rec.priority,
          currentCost: Number(rec.currentCost),
          estimatedSavings: Number(rec.estimatedSavings),
        },
        cspFindings: matchedFindings,
      });
    }
  }

  // 7. Create correlation_alert notifications for critical/high severity combos
  for (const corr of correlations) {
    const hasCriticalOrHigh = corr.cspFindings.some(
      (f) => f.severity === "critical" || f.severity === "high",
    );
    if (!hasCriticalOrHigh) continue;

    // Deduplication: check if alert exists within last 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [existing] = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.type, "correlation_alert"),
          gte(notifications.createdAt, twentyFourHoursAgo),
          sql`${notifications.metadata}->>'resourceId' = ${corr.resourceId}`,
          sql`${notifications.metadata}->>'accountId' = ${accountId}`,
        ),
      )
      .limit(1);

    if (existing) continue;

    const maxSeverity = corr.cspFindings.reduce((max, f) => {
      if (f.severity === "critical") return "critical";
      if (f.severity === "high" && max !== "critical") return "high";
      return max;
    }, "medium");

    createNotification(
      userId,
      "correlation_alert",
      `${corr.resourceId} has cost + security issues`,
      `Resource ${corr.resourceName} (${corr.service}) has a $${corr.cfmRecommendation.estimatedSavings.toFixed(0)}/mo savings opportunity and ${corr.cspFindings.length} security finding(s).`,
      {
        resourceId: corr.resourceId,
        accountId,
        severity: maxSeverity,
        estimatedSavings: corr.cfmRecommendation.estimatedSavings,
      },
    ).catch(() => {});
  }

  return correlations;
}
