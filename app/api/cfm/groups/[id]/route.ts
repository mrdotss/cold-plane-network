import { NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth/middleware";
import { getGroupById, updateGroup, deleteGroup } from "@/lib/cfm/group-queries";
import { updateGroupSchema } from "@/lib/cfm/validators";
import { writeAuditEvent } from "@/lib/audit/writer";

/**
 * PATCH /api/cfm/groups/[id] — Update a group.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await requireAuth();
    const { id } = await params;
    const body = await request.json();
    const parsed = updateGroupSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.issues },
        { status: 400 },
      );
    }

    const group = await updateGroup(id, userId, parsed.data);
    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    await writeAuditEvent({
      userId,
      eventType: "CFM_GROUP_UPDATED",
      metadata: { groupId: group.id, groupName: group.name },
    });

    return NextResponse.json({ group });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to update group" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/cfm/groups/[id] — Delete a group.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await requireAuth();
    const { id } = await params;

    const deleted = await deleteGroup(id, userId);
    if (!deleted) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    await writeAuditEvent({
      userId,
      eventType: "CFM_GROUP_DELETED",
      metadata: { groupId: id },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to delete group" },
      { status: 500 },
    );
  }
}
