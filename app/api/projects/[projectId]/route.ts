import { NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth/middleware";
import { writeAuditEvent } from "@/lib/audit/writer";
import { prisma } from "@/lib/db/client";

/**
 * DELETE /api/projects/[projectId] — Delete a project (owner only, cascade).
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { userId } = await requireAuth();
    const { projectId } = await params;

    const project = await prisma.project.findFirst({
      where: { id: projectId, createdById: userId },
    });

    if (!project) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.project.delete({ where: { id: projectId } });

    try {
      await writeAuditEvent({
        userId,
        eventType: "MIGRATION_PROJECT_DELETE",
        metadata: { projectName: project.name },
      });
    } catch {
      // Audit failure must not block the primary operation
    }

    return NextResponse.json({ data: { deleted: true } });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to delete project" }, { status: 500 });
  }
}
