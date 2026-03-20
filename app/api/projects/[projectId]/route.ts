import { NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth/middleware";
import { writeAuditEvent } from "@/lib/audit/writer";
import { db } from "@/lib/db/client";
import { projects } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

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

    const [project] = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.createdById, userId)))
      .limit(1);

    if (!project) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await db.delete(projects).where(eq(projects.id, projectId));

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
