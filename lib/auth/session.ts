import "server-only";

import crypto from "crypto";
import { db } from "@/lib/db/client";
import { sessions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const SESSION_TTL_DAYS = 7;

export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function createSession(
  userId: string
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateSessionToken();
  const expiresAt = new Date(
    Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000
  );

  await db.insert(sessions).values({ token, userId, expiresAt });

  return { token, expiresAt };
}

export async function validateSession(
  token: string
): Promise<{ userId: string } | null> {
  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.token, token))
    .limit(1);

  if (!session) return null;

  if (session.expiresAt < new Date()) {
    await db.delete(sessions).where(eq(sessions.id, session.id));
    return null;
  }

  return { userId: session.userId };
}

export async function destroySession(token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.token, token));
}
