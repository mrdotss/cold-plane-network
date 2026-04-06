import { NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth/middleware";
import { getViewById, updateView, deleteView } from "@/lib/views/queries";
import { updateViewSchema } from "@/lib/views/validators";

/**
 * PUT /api/views/[id] — Update a saved view (owner only).
 *
 * Body: { name?: string, filters?: object, sortBy?: string | null, sortOrder?: "asc" | "desc" | null }
 *
 * Response: { view: SavedView }
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await requireAuth();
    const { id } = await params;

    const body = await request.json();
    const parsed = updateViewSchema.safeParse(body);

    if (!parsed.success) {
      const message =
        parsed.error.issues[0]?.message ?? "Invalid request body";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const existing = await getViewById(id);
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (existing.userId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const view = await updateView(id, userId, parsed.data);

    return NextResponse.json({ view });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to update view" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/views/[id] — Delete a saved view (owner only).
 *
 * Response: { success: true }
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await requireAuth();
    const { id } = await params;

    const existing = await getViewById(id);
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (existing.userId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await deleteView(id, userId);

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to delete view" },
      { status: 500 },
    );
  }
}
