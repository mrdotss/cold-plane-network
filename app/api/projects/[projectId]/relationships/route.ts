import { NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth/middleware";
import { writeAuditEvent } from "@/lib/audit/writer";
import { db } from "@/lib/db/client";
import {
  projects,
  azureResources,
  azureResourceRelationships,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { extractRelationships } from "@/lib/migration/relationship-engine";
import type { AzureResourceInput } from "@/lib/migration/relationship-engine";

type RouteContext = { params: Promise<{ projectId: string }> };

/** Verify project exists and belongs to the authenticated user. */
async function verifyProjectOwnership(projectId: string, userId: string) {
  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.createdById, userId)))
    .limit(1);
  return project ?? null;
}

/** Compute stats from relationship rows. */
function computeStatsFromRows(
  rows: Array<{ relationType: string; confidence: string; method: string }>,
) {
  const byType: Record<string, number> = {};
  const byMethod: Record<string, number> = {};
  const byConfidence: Record<string, number> = {};

  for (const r of rows) {
    byType[r.relationType] = (byType[r.relationType] ?? 0) + 1;
    byMethod[r.method] = (byMethod[r.method] ?? 0) + 1;
    byConfidence[r.confidence] = (byConfidence[r.confidence] ?? 0) + 1;
  }

  return { total: rows.length, byType, byMethod, byConfidence };
}

/**
 * GET /api/projects/[projectId]/relationships
 * Returns all relationships for the project with summary statistics.
 */
export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { userId } = await requireAuth();
    const { projectId } = await params;

    if (!projectId) {
      return NextResponse.json({ error: "Invalid project ID" }, { status: 400 });
    }

    const project = await verifyProjectOwnership(projectId, userId);
    if (!project) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const rows = await db
      .select()
      .from(azureResourceRelationships)
      .where(eq(azureResourceRelationships.projectId, projectId));

    const relationships = rows.map((r) => ({
      id: r.id,
      sourceResourceId: r.sourceResourceId,
      targetResourceId: r.targetResourceId,
      relationType: r.relationType,
      confidence: r.confidence,
      method: r.method,
    }));

    return NextResponse.json({
      relationships,
      stats: computeStatsFromRows(rows),
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to fetch relationships" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/projects/[projectId]/relationships
 * Deletes existing relationships, re-extracts from all project resources,
 * persists new rows, logs audit event, and returns results.
 */
export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const { userId } = await requireAuth();
    const { projectId } = await params;

    if (!projectId) {
      return NextResponse.json({ error: "Invalid project ID" }, { status: 400 });
    }

    const project = await verifyProjectOwnership(projectId, userId);
    if (!project) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Delete existing relationships for this project
    await db
      .delete(azureResourceRelationships)
      .where(eq(azureResourceRelationships.projectId, projectId));

    // Load all project resources
    const resources = await db
      .select()
      .from(azureResources)
      .where(eq(azureResources.projectId, projectId));

    // Map DB rows to the pure-function input shape
    const inputs: AzureResourceInput[] = resources.map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      location: r.location,
      resourceGroup: r.resourceGroup,
      armId: r.armId,
      raw: r.raw,
    }));

    // Run the relationship engine
    const result = extractRelationships(inputs);

    // Persist new relationships
    if (result.relationships.length > 0) {
      await db.insert(azureResourceRelationships).values(
        result.relationships.map((rel) => ({
          projectId,
          sourceResourceId: rel.sourceResourceId,
          targetResourceId: rel.targetResourceId,
          relationType: rel.relationType,
          confidence: rel.confidence,
          method: rel.method,
        })),
      );
    }

    // Fetch persisted rows to get generated IDs
    const rows = await db
      .select()
      .from(azureResourceRelationships)
      .where(eq(azureResourceRelationships.projectId, projectId));

    const relationships = rows.map((r) => ({
      id: r.id,
      sourceResourceId: r.sourceResourceId,
      targetResourceId: r.targetResourceId,
      relationType: r.relationType,
      confidence: r.confidence,
      method: r.method,
    }));

    // Log audit event (non-blocking)
    try {
      await writeAuditEvent({
        userId,
        eventType: "MIGRATION_RELATIONSHIP_EXTRACT",
        metadata: {
          projectId,
          resourceCount: resources.length,
          relationshipCount: result.relationships.length,
          byMethod: result.stats.byMethod,
        },
      });
    } catch {
      /* audit failure must not block the primary operation */
    }

    return NextResponse.json({
      relationships,
      stats: computeStatsFromRows(rows),
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to extract relationships" },
      { status: 500 },
    );
  }
}
