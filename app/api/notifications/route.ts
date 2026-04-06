import { NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth/middleware";
import {
  listNotifications,
  markAsRead,
  dismissNotifications,
} from "@/lib/notifications/service";

/**
 * GET /api/notifications — List notifications for the authenticated user.
 *
 * Query params:
 *   - page (default: 1)
 *   - limit (default: 20)
 *   - unreadOnly (default: false)
 *
 * Response: { notifications, unreadCount, total }
 */
export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();

    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(url.searchParams.get("limit") ?? "20", 10)),
    );
    const unreadOnly = url.searchParams.get("unreadOnly") === "true";

    const result = await listNotifications(userId, { page, limit, unreadOnly });

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to fetch notifications" },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/notifications — Mark notifications as read or dismiss them.
 *
 * Body: { ids: string[], action: "read" | "dismiss" }
 *
 * - action "read" → sets readAt = now() for user-owned IDs
 * - action "dismiss" → deletes user-owned IDs + logs audit events
 * - Non-owned IDs are silently ignored.
 *
 * Response: { updated: number }
 */
export async function PATCH(request: Request) {
  try {
    const { userId } = await requireAuth();

    const body = await request.json();
    const { ids, action } = body as {
      ids?: string[];
      action?: string;
    };

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: "ids must be a non-empty array" },
        { status: 400 },
      );
    }

    if (action !== "read" && action !== "dismiss") {
      return NextResponse.json(
        { error: 'action must be "read" or "dismiss"' },
        { status: 400 },
      );
    }

    let updated: number;

    if (action === "read") {
      updated = await markAsRead(userId, ids);
    } else {
      updated = await dismissNotifications(userId, ids);
    }

    return NextResponse.json({ updated });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to update notifications" },
      { status: 500 },
    );
  }
}
