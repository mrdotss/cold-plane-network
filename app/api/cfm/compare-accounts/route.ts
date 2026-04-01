import { NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth/middleware";
import { db } from "@/lib/db/client";
import { awsAccounts, cfmScans } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import type { CfmScanSummary } from "@/lib/cfm/types";

/**
 * GET /api/cfm/compare-accounts?accountIds=id1,id2,id3
 *
 * Returns comparison data for the specified accounts.
 */
export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();
    const { searchParams } = new URL(request.url);
    const accountIdsParam = searchParams.get("accountIds");

    if (!accountIdsParam) {
      return NextResponse.json(
        { error: "accountIds query parameter is required" },
        { status: 400 },
      );
    }

    const accountIds = accountIdsParam.split(",").filter(Boolean);
    if (accountIds.length < 2) {
      return NextResponse.json(
        { error: "At least 2 account IDs are required for comparison" },
        { status: 400 },
      );
    }

    // Fetch accounts and verify ownership
    const comparisons = await Promise.all(
      accountIds.map(async (accountId) => {
        const [account] = await db
          .select()
          .from(awsAccounts)
          .where(
            and(eq(awsAccounts.id, accountId), eq(awsAccounts.userId, userId)),
          )
          .limit(1);

        if (!account) return null;

        const [latestScan] = await db
          .select()
          .from(cfmScans)
          .where(
            and(
              eq(cfmScans.accountId, accountId),
              eq(cfmScans.status, "completed"),
            ),
          )
          .orderBy(desc(cfmScans.completedAt))
          .limit(1);

        const summary = (latestScan?.summary as CfmScanSummary | null) ?? null;

        return {
          accountId: account.id,
          accountName: account.accountName,
          awsAccountId: account.awsAccountId,
          lastScanAt: latestScan?.completedAt?.toISOString() ?? null,
          totalMonthlySpend: summary?.totalMonthlySpend ?? 0,
          totalPotentialSavings: summary?.totalPotentialSavings ?? 0,
          recommendationCount: summary?.recommendationCount ?? 0,
          priorityBreakdown: summary?.priorityBreakdown ?? {
            critical: 0,
            medium: 0,
            low: 0,
          },
          serviceBreakdown: summary?.serviceBreakdown ?? [],
        };
      }),
    );

    const validComparisons = comparisons.filter(Boolean);

    return NextResponse.json({ comparisons: validComparisons });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to compare accounts" },
      { status: 500 },
    );
  }
}
