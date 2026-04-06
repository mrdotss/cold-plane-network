import { NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth/middleware";
import {
  getAnnotationById,
  updateAnnotation,
  deleteAnnotation,
} from "@/lib/annotations/queries";
import { updateAnnotationSchema } from "@/lib/annotations/validators";

/**
 * PUT /api/annotations/[id] — Update an annotation (owner only).
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await requireAuth();
    const { id } = await params;

    const body = await request.json();
    const parsed = updateAnnotationSchema.safeParse(body);

    if (!parsed.success) {
      const message =
        parsed.error.issues[0]?.message ?? "Invalid request body";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const existing = await getAnnotationById(id);
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (existing.userId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const annotation = await updateAnnotation(id, userId, parsed.data);

    return NextResponse.json({ annotation });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to update annotation" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/annotations/[id] — Delete an annotation (owner only).
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await requireAuth();
    const { id } = await params;

    const existing = await getAnnotationById(id);
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (existing.userId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await deleteAnnotation(id, userId);

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to delete annotation" },
      { status: 500 },
    );
  }
}
