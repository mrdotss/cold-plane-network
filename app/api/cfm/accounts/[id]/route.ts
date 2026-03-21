import { NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth/middleware";
import {
  getAccountById,
  getLatestScanForAccount,
  updateAccount,
  deleteAccount,
} from "@/lib/cfm/queries";
import { updateAccountSchema } from "@/lib/cfm/validators";
import { writeAuditEvent } from "@/lib/audit/writer";

/**
 * GET /api/cfm/accounts/[id]
 *
 * Get account details and the latest scan.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await requireAuth();
    const { id } = await params;

    const account = await getAccountById(id, userId);
    if (!account) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 },
      );
    }

    const latestScan = await getLatestScanForAccount(id);

    return NextResponse.json({ account, latestScan });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to get account" },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/cfm/accounts/[id]
 *
 * Update an account's fields.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await requireAuth();
    const { id } = await params;

    const body = await request.json();
    const parsed = updateAccountSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.issues },
        { status: 400 },
      );
    }

    const updated = await updateAccount(id, userId, parsed.data);
    if (!updated) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ account: updated });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to update account" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/cfm/accounts/[id]
 *
 * Delete an account with cascade (scans + recommendations).
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await requireAuth();
    const { id } = await params;

    const deleted = await deleteAccount(id, userId);
    if (!deleted) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 },
      );
    }

    await writeAuditEvent({
      userId,
      eventType: "CFM_ACCOUNT_DELETED",
      metadata: { accountId: id },
    });

    return new Response(null, { status: 204 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to delete account" },
      { status: 500 },
    );
  }
}
