import { NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth/middleware";
import { writeAuditEvent } from "@/lib/audit/writer";
import { prisma } from "@/lib/db/client";

/**
 * GET /api/projects — List projects for authenticated user (with resource count).
 */
export async function GET() {
  try {
    const { userId } = await requireAuth();

    const projects = await prisma.project.findMany({
      where: { createdById: userId },
      include: { _count: { select: { resources: true } } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data: projects });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 });
  }
}

/**
 * POST /api/projects — Create a new project.
 */
export async function POST(request: Request) {
  try {
    const { userId } = await requireAuth();
    const body = await request.json();
    const { name, customerName, notes } = body as {
      name?: string;
      customerName?: string;
      notes?: string;
    };

    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: "Project name is required" }, { status: 400 });
    }

    const project = await prisma.project.create({
      data: {
        name: name.trim(),
        customerName: customerName?.trim() ?? "",
        notes: notes?.trim() ?? "",
        createdById: userId,
      },
    });

    try {
      await writeAuditEvent({
        userId,
        eventType: "MIGRATION_PROJECT_CREATE",
        metadata: { projectName: project.name },
      });
    } catch {
      // Audit failure must not block the primary operation
    }

    return NextResponse.json({ data: project }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }
}
