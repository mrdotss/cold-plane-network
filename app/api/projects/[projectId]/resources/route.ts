import { NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth/middleware";
import { writeAuditEvent } from "@/lib/audit/writer";
import { db } from "@/lib/db/client";
import { projects, azureResources } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { manualResourceSchema, importJsonSchema } from "@/lib/validators/resource";
import { normalizeResource } from "@/lib/import-utils";

/**
 * GET /api/projects/[projectId]/resources — List resources for a project.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { userId } = await requireAuth();
    const { projectId } = await params;

    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.createdById, userId)))
      .limit(1);

    if (!project) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const resources = await db
      .select()
      .from(azureResources)
      .where(eq(azureResources.projectId, projectId))
      .orderBy(desc(azureResources.createdAt));

    return NextResponse.json({ data: resources });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to fetch resources" }, { status: 500 });
  }
}

/**
 * POST /api/projects/[projectId]/resources — Import resources (JSON or manual).
 * Body: { mode: "json", data: ... } or { mode: "manual", ...fields }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { userId } = await requireAuth();
    const { projectId } = await params;

    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.createdById, userId)))
      .limit(1);

    if (!project) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await request.json();
    const mode = body.mode as string;

    if (mode === "manual") {
      const parsed = manualResourceSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Validation failed", issues: parsed.error.issues },
          { status: 400 }
        );
      }

      const normalized = normalizeResource(parsed.data as Record<string, unknown>);
      const [resource] = await db
        .insert(azureResources)
        .values({ projectId, ...normalized })
        .returning();

      try {
        await writeAuditEvent({
          userId,
          eventType: "MIGRATION_RESOURCE_IMPORT",
          metadata: { projectId, resourceCount: 1 },
        });
      } catch { /* audit failure non-blocking */ }

      return NextResponse.json({ data: resource }, { status: 201 });
    }

    if (mode === "json") {
      const parsed = importJsonSchema.safeParse(body.data);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Validation failed", issues: parsed.error.issues },
          { status: 400 }
        );
      }

      const resources = parsed.data.map((item: Record<string, unknown>) =>
        normalizeResource(item)
      );

      const inserted = await db
        .insert(azureResources)
        .values(resources.map((r) => ({ projectId, ...r })))
        .returning({ id: azureResources.id });

      try {
        await writeAuditEvent({
          userId,
          eventType: "MIGRATION_RESOURCE_IMPORT",
          metadata: { projectId, resourceCount: inserted.length },
        });
      } catch { /* audit failure non-blocking */ }

      return NextResponse.json({ data: { count: inserted.length } }, { status: 201 });
    }

    return NextResponse.json({ error: "Invalid mode. Use 'json' or 'manual'." }, { status: 400 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to import resources" }, { status: 500 });
  }
}
