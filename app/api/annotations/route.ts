import { NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth/middleware";
import { getAnnotations, createAnnotation } from "@/lib/annotations/queries";
import { createAnnotationSchema } from "@/lib/annotations/validators";

/**
 * GET /api/annotations — List annotations for a specific target entity.
 *
 * Query params (required):
 *   - targetType: "cfm_scan" | "csp_scan" | "cfm_recommendation" | "csp_finding"
 *   - targetId: uuid of the target entity
 *
 * Response: { annotations: Annotation[] }
 */
export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();

    const url = new URL(request.url);
    const targetType = url.searchParams.get("targetType");
    const targetId = url.searchParams.get("targetId");

    if (!targetType || !targetId) {
      return NextResponse.json(
        { error: "targetType and targetId query params are required" },
        { status: 400 },
      );
    }

    const annotations = await getAnnotations(userId, targetType, targetId);

    return NextResponse.json({ annotations });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to fetch annotations" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/annotations — Create a new annotation.
 *
 * Body: { targetType: string, targetId: string, content: string }
 *
 * Response: { annotation: Annotation } with 201 status
 */
export async function POST(request: Request) {
  try {
    const { userId } = await requireAuth();

    const body = await request.json();
    const parsed = createAnnotationSchema.safeParse(body);

    if (!parsed.success) {
      const message =
        parsed.error.issues[0]?.message ?? "Invalid request body";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const annotation = await createAnnotation(userId, parsed.data);

    return NextResponse.json({ annotation }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to create annotation" },
      { status: 500 },
    );
  }
}
