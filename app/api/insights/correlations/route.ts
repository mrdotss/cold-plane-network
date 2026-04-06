import { NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth/middleware";
import { findCorrelations } from "@/lib/insights/correlations";

/**
 * GET /api/insights/correlations
 *
 * Query params:
 *   - accountId (required)
 *
 * Response: { correlations: CorrelatedResource[] }
 */
export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();

    const url = new URL(request.url);
    const accountId = url.searchParams.get("accountId");

    if (!accountId) {
      return NextResponse.json(
        { error: "accountId is required" },
        { status: 400 },
      );
    }

    const correlations = await findCorrelations(accountId, userId);

    return NextResponse.json({ correlations });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to compute correlations" },
      { status: 500 },
    );
  }
}
