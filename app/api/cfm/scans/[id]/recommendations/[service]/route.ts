import { NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth/middleware";
import { getScanById, getRecommendationsByService } from "@/lib/cfm/queries";

/**
 * GET /api/cfm/scans/[id]/recommendations/[service]
 *
 * Get recommendations for a specific service within a scan.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; service: string }> },
) {
  try {
    const { userId } = await requireAuth();
    const { id, service } = await params;

    const scan = await getScanById(id, userId);
    if (!scan) {
      return NextResponse.json(
        { error: "Scan not found" },
        { status: 404 },
      );
    }

    const recommendations = await getRecommendationsByService(id, service);

    return NextResponse.json({
      recommendations,
      total: recommendations.length,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to get recommendations" },
      { status: 500 },
    );
  }
}
