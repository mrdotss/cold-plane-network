import { NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth/middleware";
import { writeAuditEvent } from "@/lib/audit/writer";
import { prisma } from "@/lib/db/client";
import { createReportSchema } from "@/lib/sizing/validators";

/**
 * GET /api/sizing — Paginated list of sizing reports for authenticated user.
 * Query params: ?page=1&limit=10
 */
export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();
    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit")) || 10));
    const skip = (page - 1) * limit;

    const [reports, total] = await Promise.all([
      prisma.sizingReport.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.sizingReport.count({ where: { userId } }),
    ]);

    return NextResponse.json({ data: reports, total });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to fetch reports" }, { status: 500 });
  }
}

/**
 * POST /api/sizing — Create a sizing report record.
 */
export async function POST(request: Request) {
  try {
    const { userId } = await requireAuth();
    const body = await request.json();

    const parsed = createReportSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { fileName, reportType, region, totalMonthly, totalAnnual, serviceCount, metadata } =
      parsed.data;

    // Enforce 1KB metadata cap
    const metadataStr =
      Buffer.byteLength(metadata, "utf-8") > 1024
        ? JSON.stringify({ _truncated: true })
        : metadata;

    const report = await prisma.sizingReport.create({
      data: {
        userId,
        fileName,
        reportType,
        region,
        totalMonthly,
        totalAnnual,
        serviceCount,
        metadata: metadataStr,
      },
    });

    try {
      await writeAuditEvent({
        userId,
        eventType: "SIZING_GENERATE_REPORT",
        metadata: { reportType, serviceCount, totalMonthly },
      });
    } catch {
      // Audit failure must not block the primary operation
    }

    return NextResponse.json({ data: report }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to save report" }, { status: 500 });
  }
}
