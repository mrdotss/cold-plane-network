import "server-only";

import type {
  CfmRecommendation,
  CfmScanSummary,
  DeltaCategory,
  DeltaRecommendation,
  DeltaReport,
  DeltaSummary,
} from "./types";

/**
 * Compute the delta between two sets of recommendations from two scans.
 * Matching key: `${resourceId}::${service}` (composite).
 *
 * Categories:
 * - "new": in toRecs but not in fromRecs
 * - "resolved": in fromRecs but not in toRecs
 * - "changed": in both but with different values
 * - "unchanged": in both with identical values
 */
export function computeDelta(
  fromRecs: CfmRecommendation[],
  toRecs: CfmRecommendation[],
  fromScan: {
    id: string;
    completedAt: Date | null;
    summary: CfmScanSummary | null;
  },
  toScan: {
    id: string;
    completedAt: Date | null;
    summary: CfmScanSummary | null;
  },
): DeltaReport {
  // Build maps keyed by composite key
  const fromMap = new Map<string, CfmRecommendation>();
  for (const rec of fromRecs) {
    fromMap.set(`${rec.resourceId}::${rec.service}`, rec);
  }

  const toMap = new Map<string, CfmRecommendation>();
  for (const rec of toRecs) {
    toMap.set(`${rec.resourceId}::${rec.service}`, rec);
  }

  const recommendations: DeltaRecommendation[] = [];
  let newCount = 0;
  let resolvedCount = 0;
  let changedCount = 0;
  let unchangedCount = 0;

  // Process toRecs: check for "new", "changed", or "unchanged"
  for (const [key, toRec] of toMap) {
    const fromRec = fromMap.get(key);

    if (!fromRec) {
      // New recommendation
      newCount++;
      recommendations.push({
        category: "new",
        resourceId: toRec.resourceId,
        service: toRec.service,
        resourceName: toRec.resourceName,
        current: toRec,
      });
    } else {
      // Exists in both — check for changes
      const changes = detectChanges(fromRec, toRec);

      if (changes) {
        changedCount++;
        recommendations.push({
          category: "changed",
          resourceId: toRec.resourceId,
          service: toRec.service,
          resourceName: toRec.resourceName ?? fromRec.resourceName,
          current: toRec,
          previous: fromRec,
          changes,
        });
      } else {
        unchangedCount++;
        recommendations.push({
          category: "unchanged",
          resourceId: toRec.resourceId,
          service: toRec.service,
          resourceName: toRec.resourceName,
          current: toRec,
          previous: fromRec,
        });
      }
    }
  }

  // Process fromRecs: check for "resolved" (in from but not in to)
  for (const [key, fromRec] of fromMap) {
    if (!toMap.has(key)) {
      resolvedCount++;
      recommendations.push({
        category: "resolved",
        resourceId: fromRec.resourceId,
        service: fromRec.service,
        resourceName: fromRec.resourceName,
        previous: fromRec,
      });
    }
  }

  // Compute spend/savings changes from scan summaries
  const fromSpend = fromScan.summary?.totalMonthlySpend ?? 0;
  const toSpend = toScan.summary?.totalMonthlySpend ?? 0;
  const fromSavings = fromScan.summary?.totalPotentialSavings ?? 0;
  const toSavings = toScan.summary?.totalPotentialSavings ?? 0;

  const summary: DeltaSummary = {
    fromScanId: fromScan.id,
    toScanId: toScan.id,
    fromDate: fromScan.completedAt?.toISOString() ?? "",
    toDate: toScan.completedAt?.toISOString() ?? "",
    spendChange: toSpend - fromSpend,
    savingsChange: toSavings - fromSavings,
    newCount,
    resolvedCount,
    changedCount,
    unchangedCount,
  };

  // Sort: new first, then changed, then resolved, then unchanged
  const categoryOrder: Record<DeltaCategory, number> = {
    new: 0,
    changed: 1,
    resolved: 2,
    unchanged: 3,
  };
  recommendations.sort(
    (a, b) => categoryOrder[a.category] - categoryOrder[b.category],
  );

  return { summary, recommendations };
}

/**
 * Detect which fields changed between two recommendations for the same resource.
 * Returns null if no fields changed (identical).
 */
function detectChanges(
  from: CfmRecommendation,
  to: CfmRecommendation,
): DeltaRecommendation["changes"] | null {
  const priorityChanged = from.priority !== to.priority;
  const costChanged = from.currentCost !== to.currentCost;
  const savingsChanged = from.estimatedSavings !== to.estimatedSavings;
  const effortChanged = from.effort !== to.effort;
  const recommendationChanged = from.recommendation !== to.recommendation;

  if (
    !priorityChanged &&
    !costChanged &&
    !savingsChanged &&
    !effortChanged &&
    !recommendationChanged
  ) {
    return null;
  }

  return {
    priorityChanged,
    costChanged,
    savingsChanged,
    effortChanged,
    recommendationChanged,
  };
}
