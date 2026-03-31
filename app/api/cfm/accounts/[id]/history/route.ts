import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import {
  getAccountById,
  getCompletedScansForAccount,
  countCompletedScansForAccount,
} from "@/lib/cfm/queries";
import { scanHistoryQuerySchema } from "@/lib/cfm/validators";
import type {
  CfmScanSummary,
  ScanHistoryEntry,
  TrendDataPoint,
} from "@/lib/cfm/types";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await requireAuth();
    const { id: accountId } = await params;

    // Verify account ownership
    const account = await getAccountById(accountId, userId);
    if (!account) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 },
      );
    }

    // Parse query params
    const searchParams = Object.fromEntries(req.nextUrl.searchParams);
    const parsed = scanHistoryQuerySchema.safeParse(searchParams);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: parsed.error.issues },
        { status: 400 },
      );
    }

    const { from, to, limit, offset } = parsed.data;
    const dateOptions = {
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    };

    // Fetch scans and count in parallel
    const [scans, total] = await Promise.all([
      getCompletedScansForAccount(accountId, {
        ...dateOptions,
        limit,
        offset,
      }),
      countCompletedScansForAccount(accountId, dateOptions),
    ]);

    // Transform to response shapes
    const scanEntries: ScanHistoryEntry[] = scans.map((s) => ({
      id: s.id,
      status: s.status,
      summary: (s.summary as CfmScanSummary) ?? null,
      createdAt: s.createdAt.toISOString(),
      completedAt: s.completedAt?.toISOString() ?? null,
    }));

    // Extract trend data from scan summaries
    const trend: TrendDataPoint[] = scans
      .filter((s) => s.summary && s.completedAt)
      .map((s) => {
        const summary = s.summary as CfmScanSummary;
        return {
          scanId: s.id,
          date: s.completedAt!.toISOString(),
          totalMonthlySpend: summary.totalMonthlySpend,
          totalPotentialSavings: summary.totalPotentialSavings,
          recommendationCount: summary.recommendationCount,
        };
      })
      // Reverse to chronological order (oldest first) for charts
      .reverse();

    return NextResponse.json({ scans: scanEntries, trend, total });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to fetch scan history" },
      { status: 500 },
    );
  }
}
