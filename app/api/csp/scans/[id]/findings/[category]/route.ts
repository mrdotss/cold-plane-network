import { NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth/middleware";
import { getCspScanById, getEnrichedCspFindings } from "@/lib/csp/queries";

/**
 * GET /api/csp/scans/[id]/findings/[category]
 *
 * Get findings for a specific category (e.g. identity_access, network).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; category: string }> },
) {
  try {
    const { userId } = await requireAuth();
    const { id, category } = await params;

    const validCategories = [
      "identity_access",
      "network",
      "data_protection",
      "logging",
      "external_access",
    ];
    if (!validCategories.includes(category)) {
      return NextResponse.json(
        { error: "Invalid category" },
        { status: 400 },
      );
    }

    const scan = await getCspScanById(id, userId);
    if (!scan) {
      return NextResponse.json(
        { error: "Scan not found" },
        { status: 404 },
      );
    }

    const findings = await getEnrichedCspFindings(id, scan.accountId, {
      category,
    });

    return NextResponse.json({
      findings,
      total: findings.length,
      category,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to get findings" },
      { status: 500 },
    );
  }
}
