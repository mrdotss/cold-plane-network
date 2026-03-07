import { NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth/middleware";
import { writeAuditEvent } from "@/lib/audit/writer";
import { checkMappingEngineLimit } from "@/lib/auth/rate-limit";
import { prisma } from "@/lib/db/client";
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

    const project = await prisma.project.findFirst({
      where: { id: projectId, createdById: userId },
    });
    if (!project) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const resources = await prisma.azureResource.findMany({
      where: { projectId },
      include: { recommendations: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data: resources });
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

    const project = await prisma.project.findFirst({
      where: { id: projectId, createdById: userId },
    });
    if (!project) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const resources = await prisma.azureResource.findMany({
      where: { projectId },
    });

    if (resources.length === 0) {
      return NextResponse.json({ error: "No resources to map" }, { status: 400 });
    }

    // Delete existing recommendations for this project's resources
    await prisma.mappingRecommendation.deleteMany({
      where: { azureResource: { projectId } },
    });

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

    await prisma.mappingRecommendation.createMany({ data: recommendations });

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
