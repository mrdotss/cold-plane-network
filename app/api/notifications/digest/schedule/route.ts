import { NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth/middleware";
import { db } from "@/lib/db/client";
import { digestSchedules } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { CronExpressionParser } from "cron-parser";

/**
 * POST /api/notifications/digest/schedule — Upsert digest schedule.
 *
 * Body: { cronExpression: string, enabled: boolean }
 *
 * Response: { cronExpression, enabled, lastRunAt }
 */
export async function POST(request: Request) {
  try {
    const { userId } = await requireAuth();

    const body = await request.json();
    const { cronExpression, enabled } = body as {
      cronExpression?: string;
      enabled?: boolean;
    };

    if (typeof cronExpression !== "string" || cronExpression.trim().length === 0) {
      return NextResponse.json(
        { error: "cronExpression is required" },
        { status: 400 },
      );
    }

    // Validate cron expression syntax
    try {
      CronExpressionParser.parse(cronExpression.trim());
    } catch {
      return NextResponse.json(
        { error: "Invalid cron expression. Use standard 5-field format (e.g., '0 8 * * 1' for Monday 8 AM UTC)." },
        { status: 400 },
      );
    }

    if (typeof enabled !== "boolean") {
      return NextResponse.json(
        { error: "enabled must be a boolean" },
        { status: 400 },
      );
    }

    // Upsert: insert or update on conflict (userId is unique)
    const [result] = await db
      .insert(digestSchedules)
      .values({
        userId,
        cronExpression: cronExpression.trim(),
        enabled,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: digestSchedules.userId,
        set: {
          cronExpression: cronExpression.trim(),
          enabled,
          updatedAt: new Date(),
        },
      })
      .returning({
        cronExpression: digestSchedules.cronExpression,
        enabled: digestSchedules.enabled,
        lastRunAt: digestSchedules.lastRunAt,
      });

    return NextResponse.json({
      cronExpression: result.cronExpression,
      enabled: result.enabled,
      lastRunAt: result.lastRunAt?.toISOString() ?? null,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to update schedule" },
      { status: 500 },
    );
  }
}

/**
 * GET /api/notifications/digest/schedule — Get current digest schedule.
 */
export async function GET() {
  try {
    const { userId } = await requireAuth();

    const [schedule] = await db
      .select({
        cronExpression: digestSchedules.cronExpression,
        enabled: digestSchedules.enabled,
        lastRunAt: digestSchedules.lastRunAt,
      })
      .from(digestSchedules)
      .where(eq(digestSchedules.userId, userId))
      .limit(1);

    if (!schedule) {
      return NextResponse.json({
        cronExpression: "0 8 * * 1",
        enabled: false,
        lastRunAt: null,
      });
    }

    return NextResponse.json({
      cronExpression: schedule.cronExpression,
      enabled: schedule.enabled,
      lastRunAt: schedule.lastRunAt?.toISOString() ?? null,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to fetch schedule" },
      { status: 500 },
    );
  }
}
