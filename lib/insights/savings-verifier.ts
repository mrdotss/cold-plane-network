import "server-only";

import { db } from "@/lib/db/client";
import {
  cfmRecommendationTracking,
  cfmRecommendations,
  cfmScans,
} from "@/lib/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { createNotification } from "@/lib/notifications/service";

// ─── Types ───────────────────────────────────────────────────────────────────

export type SavingsVerificationStatus =
  | "pending"
  | "confirmed"
  | "partial"
  | "not_realized";

// ─── Classification ──────────────────────────────────────────────────────────

/**
 * Classify savings realization based on the ratio of actual to expected savings.
 * Exported for property-based testing.
 *
 * - confirmed: ratio ≥ 0.8
 * - partial: ratio in [0.2, 0.8)
 * - not_realized: ratio < 0.2
 */
export function classifySavings(
  expectedSavings: number,
  actualSavings: number,
): SavingsVerificationStatus {
  if (expectedSavings <= 0) return "pending";
  const ratio = actualSavings / expectedSavings;
  if (ratio >= 0.8) return "confirmed";
  if (ratio >= 0.2) return "partial";
  return "not_realized";
}

// ─── Verification Engine ─────────────────────────────────────────────────────

/**
 * Verify savings for implemented recommendations after a new CFM scan completes.
 * Compares resource costs between the current scan and the pre-implementation scan.
 */
export async function verifySavings(
  accountId: string,
  scanId: string,
  userId: string,
): Promise<void> {
  // 1. Find tracking records with status="implemented" and verificationStatus="pending"
  const pendingRecords = await db
    .select({
      id: cfmRecommendationTracking.id,
      resourceId: cfmRecommendationTracking.resourceId,
      service: cfmRecommendationTracking.service,
      expectedSavings: cfmRecommendationTracking.expectedSavings,
      firstSeenScanId: cfmRecommendationTracking.firstSeenScanId,
    })
    .from(cfmRecommendationTracking)
    .where(
      and(
        eq(cfmRecommendationTracking.accountId, accountId),
        eq(cfmRecommendationTracking.status, "implemented"),
        eq(cfmRecommendationTracking.verificationStatus, "pending"),
      ),
    );

  if (pendingRecords.length === 0) return;

  // 2. Get current scan's recommendations (resource costs)
  const currentRecs = await db
    .select({
      resourceId: cfmRecommendations.resourceId,
      service: cfmRecommendations.service,
      currentCost: cfmRecommendations.currentCost,
    })
    .from(cfmRecommendations)
    .where(eq(cfmRecommendations.scanId, scanId));

  const currentCostMap = new Map<string, number>();
  for (const rec of currentRecs) {
    currentCostMap.set(`${rec.resourceId}::${rec.service}`, Number(rec.currentCost));
  }

  // 3. For each pending record, compare costs
  for (const record of pendingRecords) {
    const key = `${record.resourceId}::${record.service}`;
    const currentCost = currentCostMap.get(key);

    // Skip if resource not found in current scan (leave as pending)
    if (currentCost === undefined) continue;

    // Get the pre-implementation cost from the firstSeenScan
    const [preImplRec] = await db
      .select({ currentCost: cfmRecommendations.currentCost })
      .from(cfmRecommendations)
      .where(
        and(
          eq(cfmRecommendations.scanId, record.firstSeenScanId),
          eq(cfmRecommendations.resourceId, record.resourceId),
          eq(cfmRecommendations.service, record.service),
        ),
      )
      .limit(1);

    if (!preImplRec) continue;

    const previousCost = Number(preImplRec.currentCost);
    const actualSavings = Math.max(0, previousCost - currentCost);
    const expected = Number(record.expectedSavings ?? 0);
    const status = classifySavings(expected, actualSavings);

    // 4. Update tracking record
    await db
      .update(cfmRecommendationTracking)
      .set({
        actualSavings: actualSavings.toFixed(2),
        verificationStatus: status,
        verifiedAt: new Date(),
        verifiedScanId: scanId,
        updatedAt: new Date(),
      })
      .where(eq(cfmRecommendationTracking.id, record.id));

    // 5. Create savings_verified notification
    createNotification(
      userId,
      "savings_verified",
      `Savings ${status}: ${record.resourceId}`,
      `Resource ${record.resourceId} (${record.service}): expected $${expected.toFixed(2)}/mo, actual $${actualSavings.toFixed(2)}/mo savings.`,
      {
        resourceId: record.resourceId,
        expectedSavings: expected,
        actualSavings,
      },
    ).catch(() => {});
  }
}
