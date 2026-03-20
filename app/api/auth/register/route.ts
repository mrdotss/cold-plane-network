import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db/client";
import { users, auditEvents } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import {
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
} from "@/lib/auth/cookie";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password } = body as {
      username?: string;
      password?: string;
    };

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // Check for existing user — return generic message to prevent enumeration
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    if (existing) {
      return NextResponse.json(
        { error: "Registration failed" },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);
    const [user] = await db
      .insert(users)
      .values({ username, passwordHash })
      .returning({ id: users.id, username: users.username });

    const { token, expiresAt } = await createSession(user.id);

    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, token, {
      ...SESSION_COOKIE_OPTIONS,
      expires: expiresAt,
    });

    // Log audit event (fire-and-forget — audit should not block registration)
    try {
      await db.insert(auditEvents).values({
        userId: user.id,
        eventType: "AUTH_REGISTER",
        metadata: JSON.stringify({ username }),
        ipAddress:
          request.headers.get("x-forwarded-for") ??
          request.headers.get("x-real-ip") ??
          null,
        userAgent: request.headers.get("user-agent") ?? null,
      });
    } catch {
      // Audit write failure should not block the user
    }

    return NextResponse.json(
      { user: { id: user.id, username: user.username } },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { error: "Registration failed" },
      { status: 500 }
    );
  }
}
