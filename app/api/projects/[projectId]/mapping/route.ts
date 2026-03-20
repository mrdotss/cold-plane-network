import { NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth/middleware";
import { writeAuditEvent } from "@/lib/audit/writer";
import { checkMappingEngineLimit } from "@/lib/auth/rate-limit";
import { db } from "@/lib/db/client";
import { projects, azureResources, mappingRecommendations } from "@/lib/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { findMapping } from "@/lib/mapping-engine";

/**
 * GET /api/projects/[projectId]/mapping — Get resources with their recommendations.
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

    const resourceIds = resources.map((r) => r.id);
    const recs = resourceIds.length > 0
      ? await db
          .select()
          .from(mappingRecommendations)
          .where(inArray(mappingRecommendations.azureResourceId, resourceIds))
      : [];

    // Group recommendations by resource
    const recsByResource = new Map<string, typeof recs>();
    for (const rec of recs) {
      const list = recsByResource.get(rec.azureResourceId) ?? [];
      list.push(rec);
      recsByResource.set(rec.azureResourceId, list);
    }

    const data = resources.map((r) => ({
      ...r,
      recommendations: recsByResource.get(r.id) ?? [],
    }));

    return NextResponse.json({ data });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to fetch mappings" }, { status: 500 });
  }
}

/**
 * POST /api/projects/[projectId]/mapping — Run mapping engine on all project resources.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { userId } = await requireAuth();

    // Rate limit: 10 mapping operations per hour per user (expensive operation)
    const { allowed, remaining, resetAt } = checkMappingEngineLimit(userId);
    if (!allowed) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded. Too many mapping engine attempts.",
          retryAfter: Math.ceil((resetAt - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            "Retry-After": Math.ceil((resetAt - Date.now()) / 1000).toString(),
            "X-RateLimit-Remaining": remaining.toString(),
            "X-RateLimit-Reset": new Date(resetAt).toISOString(),
          },
        }
      );
    }

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
      .where(eq(azureResources.projectId, projectId));

    if (resources.length === 0) {
      return NextResponse.json({ error: "No resources to map" }, { status: 400 });
    }

    // Delete existing recommendations for this project's resources
    const resourceIds = resources.map((r) => r.id);
    await db
      .delete(mappingRecommendations)
      .where(inArray(mappingRecommendations.azureResourceId, resourceIds));

    // Run mapping engine and persist recommendations
    const recommendations = [];
    for (const resource of resources) {
      const result = findMapping(resource.type, resource.kind, resource.sku);
      const primaryService = result.awsServices[0];

      recommendations.push({
        azureResourceId: resource.id,
        awsService: primaryService?.service ?? "",
        awsCategory: primaryService?.category ?? result.category,
        confidence: result.confidence,
        rationale: result.rationale,
        migrationNotes: result.migrationNotes,
        alternatives: JSON.stringify(result.alternatives),
      });
    }

    await db.insert(mappingRecommendations).values(recommendations);

    try {
      await writeAuditEvent({
        userId,
        eventType: "MIGRATION_MAPPING_RUN",
        metadata: { projectId, resourceCount: resources.length },
      });
    } catch { /* audit failure non-blocking */ }

    return NextResponse.json(
      { data: { mappedCount: recommendations.length } },
      {
        headers: {
          "X-RateLimit-Remaining": remaining.toString(),
          "X-RateLimit-Reset": new Date(resetAt).toISOString(),
        },
      }
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to run mapping" }, { status: 500 });
  }
}
