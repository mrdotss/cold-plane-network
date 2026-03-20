import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db/client";
import { users, auditEvents } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import {
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
} from "@/lib/auth/cookie";
import { checkRateLimit } from "@/lib/auth/rate-limit";

const GENERIC_ERROR = "Invalid credentials";

export async function POST(request: Request) {
  try {
    const ip =
      request.headers.get("x-forwarded-for") ??
      request.headers.get("x-real-ip") ??
      "unknown";

    const { allowed } = checkRateLimit(ip);
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Try again later." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { username, password } = body as {
      username?: string;
      password?: string;
    };

    if (!username || !password) {
      return NextResponse.json(
        { error: GENERIC_ERROR },
        { status: 401 }
      );
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    if (!user) {
      logFailure(null, username, ip, request.headers.get("user-agent"));
      return NextResponse.json(
        { error: GENERIC_ERROR },
        { status: 401 }
      );
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      logFailure(user.id, username, ip, request.headers.get("user-agent"));
      return NextResponse.json(
        { error: GENERIC_ERROR },
        { status: 401 }
      );
    }

    const { token, expiresAt } = await createSession(user.id);

    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, token, {
      ...SESSION_COOKIE_OPTIONS,
      expires: expiresAt,
    });

    // Log success
    try {
      await db.insert(auditEvents).values({
        userId: user.id,
        eventType: "AUTH_LOGIN_SUCCESS",
        metadata: JSON.stringify({ username }),
        ipAddress: ip !== "unknown" ? ip : null,
        userAgent: request.headers.get("user-agent") ?? null,
      });
    } catch {
      // Audit write failure should not block login
    }

    return NextResponse.json({
      user: { id: user.id, username: user.username },
    });
  } catch {
    return NextResponse.json(
      { error: GENERIC_ERROR },
      { status: 500 }
    );
  }
}

function logFailure(
  userId: string | null,
  username: string,
  ip: string,
  userAgent: string | null
) {
  // Fire-and-forget — we don't await this
  if (userId) {
    db.insert(auditEvents)
      .values({
        userId,
        eventType: "AUTH_LOGIN_FAILURE",
        metadata: JSON.stringify({
          username,
          reason: "Invalid credentials",
        }),
        ipAddress: ip !== "unknown" ? ip : null,
        userAgent: userAgent ?? null,
      })
      .catch(() => {});
  }
}
