import { NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth/middleware";
import { getCspScanById, getEnrichedCspFindings } from "@/lib/csp/queries";
import { cspFindingsQuerySchema } from "@/lib/csp/validators";

/**
 * GET /api/csp/scans/[id]/findings
 *
 * List all findings for a CSP scan, enriched with lifecycle tracking.
 * Optional query params: ?category=network&severity=critical
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await requireAuth();
    const { id } = await params;

    const scan = await getCspScanById(id, userId);
    if (!scan) {
      return NextResponse.json(
        { error: "Scan not found" },
        { status: 404 },
      );
    }

    const url = new URL(request.url);
    const parsed = cspFindingsQuerySchema.safeParse({
      category: url.searchParams.get("category") ?? undefined,
      severity: url.searchParams.get("severity") ?? undefined,
    });

    const filters = parsed.success ? parsed.data : {};

    const findings = await getEnrichedCspFindings(id, scan.accountId, {
      category: filters.category,
      severity: filters.severity,
    });

    return NextResponse.json({
      findings,
      total: findings.length,
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
