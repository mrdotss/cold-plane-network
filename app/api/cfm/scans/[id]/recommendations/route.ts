import { NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth/middleware";
import {
  getScanById,
  getRecommendationsByScan,
  getRecommendationsByService,
} from "@/lib/cfm/queries";

/**
 * GET /api/cfm/scans/[id]/recommendations
 *
 * List all recommendations for a scan.
 * Optional query param: ?service=EC2 to filter by service.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await requireAuth();
    const { id } = await params;

    const scan = await getScanById(id, userId);
    if (!scan) {
      return NextResponse.json(
        { error: "Scan not found" },
        { status: 404 },
      );
    }

    const url = new URL(request.url);
    const serviceFilter = url.searchParams.get("service");

    const recommendations = serviceFilter
      ? await getRecommendationsByService(id, serviceFilter)
      : await getRecommendationsByScan(id);

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
