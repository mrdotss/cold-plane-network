import "server-only";

import { cookies } from "next/headers";
import { validateSession } from "./session";
import { SESSION_COOKIE_NAME } from "./cookie";

export async function requireAuth(): Promise<{ userId: string }> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    throw new AuthError("Unauthorized");
  }

  const session = await validateSession(token);
  if (!session) {
    throw new AuthError("Unauthorized");
  }

  return { userId: session.userId };
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}
