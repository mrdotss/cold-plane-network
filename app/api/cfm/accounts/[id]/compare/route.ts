import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import {
  getAccountById,
  getScansForComparison,
  getRecommendationsByScan,
} from "@/lib/cfm/queries";
import { compareQuerySchema } from "@/lib/cfm/validators";
import { computeDelta } from "@/lib/cfm/delta";
import type { CfmRecommendation, CfmScanSummary } from "@/lib/cfm/types";

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
    const parsed = compareQuerySchema.safeParse(searchParams);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: parsed.error.issues },
        { status: 400 },
      );
    }

    const { from: fromScanId, to: toScanId } = parsed.data;

    // Fetch both scans
    const scans = await getScansForComparison(
      accountId,
      userId,
      fromScanId,
      toScanId,
    );
    if (!scans) {
      return NextResponse.json(
        { error: "One or both scans not found for this account" },
        { status: 404 },
      );
    }

    // Fetch recommendations for both scans
    const [fromRecsRaw, toRecsRaw] = await Promise.all([
      getRecommendationsByScan(scans.fromScan.id),
      getRecommendationsByScan(scans.toScan.id),
    ]);

    // Map DB rows to typed objects
    const mapRec = (r: (typeof fromRecsRaw)[number]): CfmRecommendation => ({
      id: r.id,
      scanId: r.scanId,
      service: r.service,
      resourceId: r.resourceId,
      resourceName: r.resourceName,
      priority: r.priority as CfmRecommendation["priority"],
      recommendation: r.recommendation,
      currentCost: Number(r.currentCost),
      estimatedSavings: Number(r.estimatedSavings),
      effort: r.effort as CfmRecommendation["effort"],
      metadata: (r.metadata ?? {}) as Record<string, unknown>,
      createdAt: r.createdAt,
    });

    const fromRecs = fromRecsRaw.map(mapRec);
    const toRecs = toRecsRaw.map(mapRec);

    // Compute delta
    const delta = computeDelta(
      fromRecs,
      toRecs,
      {
        id: scans.fromScan.id,
        completedAt: scans.fromScan.completedAt,
        summary: (scans.fromScan.summary as CfmScanSummary) ?? null,
      },
      {
        id: scans.toScan.id,
        completedAt: scans.toScan.completedAt,
        summary: (scans.toScan.summary as CfmScanSummary) ?? null,
      },
    );

    return NextResponse.json({ delta });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to compare scans" },
      { status: 500 },
    );
  }
}
