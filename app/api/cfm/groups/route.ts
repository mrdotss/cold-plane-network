import { NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth/middleware";
import { getGroupsByUser, createGroup } from "@/lib/cfm/group-queries";
import { createGroupSchema } from "@/lib/cfm/validators";
import { writeAuditEvent } from "@/lib/audit/writer";

/**
 * GET /api/cfm/groups — List all account groups for the authenticated user.
 */
export async function GET() {
  try {
    const { userId } = await requireAuth();
    const groups = await getGroupsByUser(userId);
    return NextResponse.json({ groups });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to fetch groups" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/cfm/groups — Create a new account group.
 */
export async function POST(request: Request) {
  try {
    const { userId } = await requireAuth();
    const body = await request.json();
    const parsed = createGroupSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.issues },
        { status: 400 },
      );
    }

    const group = await createGroup(userId, parsed.data);

    await writeAuditEvent({
      userId,
      eventType: "CFM_GROUP_CREATED",
      metadata: { groupId: group.id, groupName: group.name },
    });

    return NextResponse.json({ group }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Handle unique constraint violation
    if (
      err instanceof Error &&
      err.message.includes("unique")
    ) {
      return NextResponse.json(
        { error: "A group with this name already exists" },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "Failed to create group" },
      { status: 500 },
    );
  }
}
