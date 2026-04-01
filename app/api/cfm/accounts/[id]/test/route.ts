import { NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth/middleware";
import { testConnection } from "@/lib/aws/connection";
import { db } from "@/lib/db/client";
import { awsAccounts } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import type { TestConnectionResponse } from "@/lib/cfm/types";

/**
 * POST /api/cfm/accounts/[id]/test
 *
 * Test the AWS connection by attempting STS AssumeRole.
 * Returns { success, error?, accountAlias? } — STS failures are returned
 * as success: false with a user-facing error message, NOT as HTTP errors.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth();
    const { id } = await params;

    // Verify account exists and belongs to the authenticated user
    const [account] = await db
      .select()
      .from(awsAccounts)
      .where(and(eq(awsAccounts.id, id), eq(awsAccounts.userId, userId)))
      .limit(1);

    if (!account) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 }
      );
    }

    // Test the connection — errors are mapped to user-facing messages
    const result: TestConnectionResponse = await testConnection(
      account.roleArn,
      account.externalId
    );

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to test connection" },
      { status: 500 }
    );
  }
}
