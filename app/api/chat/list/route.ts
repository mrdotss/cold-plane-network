import { NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth/middleware";
import { listChats } from "@/lib/chat/queries";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

/**
 * GET /api/chat/list
 * Paginated list of user's chats sorted by updatedAt descending.
 * Query params: ?page=1&limit=20
 */
export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();

    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, Number(url.searchParams.get("limit")) || DEFAULT_LIMIT),
    );

    const result = await listChats(userId, page, limit);

    return NextResponse.json({
      chats: result.chats,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
      },
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to list chats" },
      { status: 500 },
    );
  }
}
