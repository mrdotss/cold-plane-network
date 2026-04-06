import { NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth/middleware";
import { db } from "@/lib/db/client";
import {
  cfmRecommendationTracking,
  cfmRecommendations,
  cfmScans,
  awsAccounts,
} from "@/lib/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";

/**
 * GET /api/insights/savings-tracker
 *
 * Returns tracked recommendations with verification status for the authenticated user.
 * Joins cfmRecommendationTracking with cfmRecommendations from the latest completed
 * scan via matching (resourceId, service) on the same account.
 *
 * Response: { tracked: SavingsTrackerItem[], summary: { totalExpectedSavings, totalActualSavings } }
 */
export async function GET() {
  try {
    const { userId } = await requireAuth();

    // Get all accounts for this user
    const accounts = await db
      .select({ id: awsAccounts.id })
      .from(awsAccounts)
      .where(eq(awsAccounts.userId, userId));

    if (accounts.length === 0) {
      return NextResponse.json({
        tracked: [],
        summary: { totalExpectedSavings: 0, totalActualSavings: 0 },
      });
    }

    const accountIds = accounts.map((a) => a.id);

    // Get all implemented tracking records for user's accounts
    const trackingRecords = await db
      .select({
        trackingId: cfmRecommendationTracking.id,
        accountId: cfmRecommendationTracking.accountId,
        resourceId: cfmRecommendationTracking.resourceId,
        service: cfmRecommendationTracking.service,
        expectedSavings: cfmRecommendationTracking.expectedSavings,
        actualSavings: cfmRecommendationTracking.actualSavings,
        verificationStatus: cfmRecommendationTracking.verificationStatus,
        implementedAt: cfmRecommendationTracking.implementedAt,
        verifiedAt: cfmRecommendationTracking.verifiedAt,
      })
      .from(cfmRecommendationTracking)
      .where(
        and(
          eq(cfmRecommendationTracking.status, "implemented"),
          sql`${cfmRecommendationTracking.accountId} = ANY(${accountIds})`,
        ),
      );

    // Build response
    let totalExpectedSavings = 0;
    let totalActualSavings = 0;

    const tracked = trackingRecords.map((r) => {
      const expected = Number(r.expectedSavings ?? 0);
      const actual = Number(r.actualSavings ?? 0);
      totalExpectedSavings += expected;
      totalActualSavings += actual;

      return {
        trackingId: r.trackingId,
        accountId: r.accountId,
        resourceId: r.resourceId,
        service: r.service,
        expectedSavings: expected,
        actualSavings: r.actualSavings != null ? actual : null,
        verificationStatus: r.verificationStatus ?? "pending",
        implementedAt: r.implementedAt?.toISOString() ?? null,
        verifiedAt: r.verifiedAt?.toISOString() ?? null,
      };
    });

    return NextResponse.json({
      tracked,
      summary: {
        totalExpectedSavings: Math.round(totalExpectedSavings * 100) / 100,
        totalActualSavings: Math.round(totalActualSavings * 100) / 100,
      },
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to fetch savings tracker data" },
      { status: 500 },
    );
  }
}
