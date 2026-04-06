import { NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth/middleware";
import { getViewsByUser, createView } from "@/lib/views/queries";
import { createViewSchema } from "@/lib/views/validators";

/**
 * GET /api/views — List saved views for the authenticated user.
 *
 * Query params:
 *   - feature (optional): "cfm" | "csp" — filter by feature
 *
 * Response: { views: SavedView[] }
 */
export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();

    const url = new URL(request.url);
    const feature = url.searchParams.get("feature") ?? undefined;

    const views = await getViewsByUser(userId, feature);

    return NextResponse.json({ views });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to fetch views" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/views — Create a new saved view.
 *
 * Body: { name: string, feature: "cfm" | "csp", filters: object, sortBy?: string, sortOrder?: "asc" | "desc" }
 *
 * Response: { view: SavedView } with 201 status
 */
export async function POST(request: Request) {
  try {
    const { userId } = await requireAuth();

    const body = await request.json();
    const parsed = createViewSchema.safeParse(body);

    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Invalid request body";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const view = await createView(userId, parsed.data);

    return NextResponse.json({ view }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to create view" },
      { status: 500 },
    );
  }
}
