import { NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth/middleware";
import { writeAuditEvent } from "@/lib/audit/writer";
import { db } from "@/lib/db/client";
import { projects, azureResources, mappingRecommendations } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { generateMarkdownReport, generateCsvReport } from "@/lib/export";

/**
 * POST /api/projects/[projectId]/export — Generate and return a report.
 * Body: { format: "markdown" | "csv" }
 */
export async function POST(
  request: Request,
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

    // Fetch resources
    const resources = await db
      .select()
      .from(azureResources)
      .where(eq(azureResources.projectId, projectId));

    if (resources.length === 0) {
      return NextResponse.json({ error: "Project has no resources to export" }, { status: 400 });
    }

    // Fetch all recommendations for these resources
    const resourceIds = resources.map((r) => r.id);
    const recs = await db
      .select()
      .from(mappingRecommendations)
      .where(inArray(mappingRecommendations.azureResourceId, resourceIds));

    // Group recommendations by resource ID
    const recsByResource = new Map<string, typeof recs>();
    for (const rec of recs) {
      const list = recsByResource.get(rec.azureResourceId) ?? [];
      list.push(rec);
      recsByResource.set(rec.azureResourceId, list);
    }

    const hasRecommendations = recs.length > 0;
    if (!hasRecommendations) {
      return NextResponse.json({ error: "Run mapping before exporting" }, { status: 400 });
    }

    const body = await request.json();
    const format = body.format as string;

    if (format !== "markdown" && format !== "csv") {
      return NextResponse.json({ error: "Invalid format. Use 'markdown' or 'csv'." }, { status: 400 });
    }

    const exportProject = {
      name: project.name,
      customerName: project.customerName,
      notes: project.notes,
      resources: resources.map((r) => ({
        name: r.name,
        type: r.type,
        location: r.location,
        recommendations: (recsByResource.get(r.id) ?? []).map((rec) => ({
          awsService: rec.awsService,
          awsCategory: rec.awsCategory,
          confidence: rec.confidence,
          rationale: rec.rationale,
          migrationNotes: rec.migrationNotes,
          alternatives: rec.alternatives,
        })),
      })),
    };

    const content = format === "markdown"
      ? generateMarkdownReport(exportProject)
      : generateCsvReport(exportProject);

    try {
      await writeAuditEvent({
        userId,
        eventType: "MIGRATION_REPORT_EXPORT",
        metadata: { projectId, format },
      });
    } catch { /* audit failure non-blocking */ }

    return NextResponse.json({ data: { content, format } });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to export report" }, { status: 500 });
  }
}
