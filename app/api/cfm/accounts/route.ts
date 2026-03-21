import { NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth/middleware";
import { getAccountsByUser, createAccount } from "@/lib/cfm/queries";
import { createAccountSchema } from "@/lib/cfm/validators";
import { writeAuditEvent } from "@/lib/audit/writer";

/**
 * GET /api/cfm/accounts
 *
 * List all CFM accounts for the authenticated user.
 */
export async function GET() {
  try {
    const { userId } = await requireAuth();
    const accounts = await getAccountsByUser(userId);
    return NextResponse.json({ accounts });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to list accounts" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/cfm/accounts
 *
 * Create a new CFM account connection.
 */
export async function POST(request: Request) {
  try {
    const { userId } = await requireAuth();

    const body = await request.json();
    const parsed = createAccountSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.issues },
        { status: 400 },
      );
    }

    const account = await createAccount(userId, parsed.data);

    await writeAuditEvent({
      userId,
      eventType: "CFM_ACCOUNT_CONNECTED",
      metadata: { accountId: account.id, awsAccountId: account.awsAccountId },
    });

    return NextResponse.json({ account }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Handle duplicate constraint violation (unique user + awsAccountId)
    if (
      err instanceof Error &&
      (err.message.includes("unique") ||
        err.message.includes("idx_cfm_accounts_user_aws"))
    ) {
      return NextResponse.json(
        { error: "Account already connected" },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { error: "Failed to create account" },
      { status: 500 },
    );
  }
}
