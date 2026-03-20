import { NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth/middleware";
import { db } from "@/lib/db/client";
import { sizingReports } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

/**
 * GET /api/sizing/[id] — Get a single sizing report (must belong to authenticated user).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth();
    const { id } = await params;

    const [report] = await db
      .select()
      .from(sizingReports)
      .where(and(eq(sizingReports.id, id), eq(sizingReports.userId, userId)))
      .limit(1);

    if (!report) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ data: report });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to fetch report" }, { status: 500 });
  }
}

/**
 * DELETE /api/sizing/[id] — Delete a sizing report (must belong to authenticated user).
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth();
    const { id } = await params;

    const [report] = await db
      .select()
      .from(sizingReports)
      .where(and(eq(sizingReports.id, id), eq(sizingReports.userId, userId)))
      .limit(1);

    if (!report) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await db.delete(sizingReports).where(eq(sizingReports.id, id));

    return NextResponse.json({ data: { deleted: true } });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to delete report" }, { status: 500 });
  }
}
