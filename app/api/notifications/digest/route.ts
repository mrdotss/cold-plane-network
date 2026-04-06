import { NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth/middleware";
import { generateDigest } from "@/lib/notifications/digest";

/**
 * POST /api/notifications/digest — Trigger digest generation.
 *
 * Body (optional): { accountIds?: string[] }
 *
 * Response: { notificationId: string }
 */
export async function POST(request: Request) {
  try {
    const { userId } = await requireAuth();

    let accountIds: string[] | undefined;
    try {
      const body = await request.json();
      if (Array.isArray(body?.accountIds)) {
        accountIds = body.accountIds;
      }
    } catch {
      // Empty body is fine — defaults to all accounts
    }

    const result = await generateDigest(userId, accountIds);

    return NextResponse.json({ notificationId: result.notificationId });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to generate digest" },
      { status: 500 },
    );
  }
}
