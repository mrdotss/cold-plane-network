import { NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth/middleware";
import { writeAuditEvent } from "@/lib/audit/writer";
import { isValidEventType } from "@/lib/audit/events";
import { prisma } from "@/lib/db/client";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

/**
 * POST /api/audit — Log an audit event (requires auth).
 */
export async function POST(request: Request) {
  try {
    const { userId } = await requireAuth();

    const body = await request.json();
    const { eventType, metadata } = body as {
      eventType?: string;
      metadata?: Record<string, unknown>;
    };

    if (!eventType || !isValidEventType(eventType)) {
      return NextResponse.json(
        { error: "Invalid event type" },
        { status: 400 }
      );
    }

    await writeAuditEvent({
      userId,
      eventType,
      metadata: metadata ?? {},
      ipAddress:
        request.headers.get("x-forwarded-for") ??
        request.headers.get("x-real-ip") ??
        undefined,
      userAgent: request.headers.get("user-agent") ?? undefined,
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to log audit event" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/audit — List audit events paginated (requires auth, user-scoped).
 *
 * Query params:
 *   - page (default: 1)
 *   - pageSize (default: 20, max: 100)
 *   - eventType (optional filter)
 *   - from (optional ISO date filter)
 *   - to (optional ISO date filter)
 */
export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();

    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, parseInt(url.searchParams.get("pageSize") ?? String(DEFAULT_PAGE_SIZE), 10))
    );
    const eventTypeFilter = url.searchParams.get("eventType");
    const fromDate = url.searchParams.get("from");
    const toDate = url.searchParams.get("to");

    // Build where clause — always scoped to the authenticated user
    const where: Record<string, unknown> = { userId };

    if (eventTypeFilter && isValidEventType(eventTypeFilter)) {
      where.eventType = eventTypeFilter;
    }

    if (fromDate || toDate) {
      const createdAt: Record<string, Date> = {};
      if (fromDate) createdAt.gte = new Date(fromDate);
      if (toDate) createdAt.lte = new Date(toDate);
      where.createdAt = createdAt;
    }

    const [events, total] = await Promise.all([
      prisma.auditEvent.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.auditEvent.count({ where }),
    ]);

    return NextResponse.json({
      events,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to fetch audit events" },
      { status: 500 }
    );
  }
}
