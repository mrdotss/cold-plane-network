import "server-only";

import crypto from "crypto";
import { prisma } from "@/lib/db/client";

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

  await prisma.session.create({
    data: { token, userId, expiresAt },
  });

  return { token, expiresAt };
}

export async function validateSession(
  token: string
): Promise<{ userId: string } | null> {
  const session = await prisma.session.findUnique({
    where: { token },
  });

  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: session.id } });
    return null;
  }

  return { userId: session.userId };
}

export async function destroySession(token: string): Promise<void> {
  await prisma.session.deleteMany({ where: { token } });
}
