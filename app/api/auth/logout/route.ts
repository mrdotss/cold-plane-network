import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { destroySession } from "@/lib/auth/session";
import { requireAuth } from "@/lib/auth/middleware";
import { SESSION_COOKIE_NAME } from "@/lib/auth/cookie";
import { db } from "@/lib/db/client";
import { auditEvents } from "@/lib/db/schema";

export async function POST(request: Request) {
  try {
    const { userId } = await requireAuth();

    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (token) {
      await destroySession(token);
    }

    cookieStore.delete(SESSION_COOKIE_NAME);

    // Log audit event
    try {
      await db.insert(auditEvents).values({
        userId,
        eventType: "AUTH_LOGOUT",
        metadata: JSON.stringify({}),
        ipAddress:
          request.headers.get("x-forwarded-for") ??
          request.headers.get("x-real-ip") ??
          null,
        userAgent: request.headers.get("user-agent") ?? null,
      });
    } catch {
      // Audit write failure should not block logout
    }

    return NextResponse.json({ success: true });
  } catch {
    // Even if auth fails, clear the cookie
    const cookieStore = await cookies();
    cookieStore.delete(SESSION_COOKIE_NAME);
    return NextResponse.json({ success: true });
  }
}
