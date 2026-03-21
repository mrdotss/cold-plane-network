import { NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth/middleware";
import { getScanById } from "@/lib/cfm/queries";

/**
 * GET /api/cfm/scans/[id]
 *
 * Return scan details including summary.
 */
export async function GET(
  _request: Request,
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

    return NextResponse.json({ scan });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to get scan" },
      { status: 500 },
    );
  }
}
