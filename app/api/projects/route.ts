import { NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth/middleware";
import { writeAuditEvent } from "@/lib/audit/writer";
import { checkProjectCreationLimit } from "@/lib/auth/rate-limit";
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

    // Rate limit: 20 projects per hour per user
    const { allowed, remaining, resetAt } = checkProjectCreationLimit(userId);
    if (!allowed) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded. Too many project creation attempts.",
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

    return NextResponse.json(
      { data: project },
      {
        status: 201,
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
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }
}
