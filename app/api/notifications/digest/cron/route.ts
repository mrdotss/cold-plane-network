import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { digestSchedules } from "@/lib/db/schema";
import { eq, and, lte, isNull, or } from "drizzle-orm";
import { generateDigest } from "@/lib/notifications/digest";
import { CronExpressionParser } from "cron-parser";

/**
 * GET /api/notifications/digest/cron
 *
 * Called by Vercel Cron (or external scheduler) every hour.
 * Evaluates all enabled digest schedules, fires digest generation
 * for any that are due, and updates lastRunAt.
 *
 * Protected by CRON_SECRET to prevent unauthorized invocations.
 */
export async function GET(request: Request) {
  // Verify cron secret (Vercel injects this header for cron jobs)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const results: Array<{ userId: string; status: string; notificationId?: string; error?: string }> = [];

  try {
    // 1. Fetch all enabled schedules
    const schedules = await db
      .select({
        id: digestSchedules.id,
        userId: digestSchedules.userId,
        cronExpression: digestSchedules.cronExpression,
        lastRunAt: digestSchedules.lastRunAt,
      })
      .from(digestSchedules)
      .where(eq(digestSchedules.enabled, true));

    if (schedules.length === 0) {
      return NextResponse.json({ processed: 0, results: [] });
    }

    // 2. For each schedule, determine if it should have fired since lastRunAt
    for (const schedule of schedules) {
      try {
        const isDue = isScheduleDue(
          schedule.cronExpression,
          schedule.lastRunAt,
          now,
        );

        if (!isDue) {
          results.push({ userId: schedule.userId, status: "not_due" });
          continue;
        }

        // 3. Generate digest
        const result = await generateDigest(schedule.userId, undefined, "scheduled");

        // 4. Update lastRunAt
        await db
          .update(digestSchedules)
          .set({ lastRunAt: now, updatedAt: now })
          .where(eq(digestSchedules.id, schedule.id));

        results.push({
          userId: schedule.userId,
          status: "generated",
          notificationId: result.notificationId,
        });
      } catch (err) {
        results.push({
          userId: schedule.userId,
          status: "error",
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({
      processed: schedules.length,
      generated: results.filter((r) => r.status === "generated").length,
      results,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: "Cron execution failed",
        detail: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

/**
 * Determine if a cron schedule is due for execution.
 *
 * Strategy: parse the cron expression, find the most recent fire time
 * before `now`, and check if it falls after `lastRunAt`.
 *
 * If lastRunAt is null (never run), the schedule is due.
 */
function isScheduleDue(
  cronExpression: string,
  lastRunAt: Date | null,
  now: Date,
): boolean {
  // Never run before → always due
  if (!lastRunAt) return true;

  try {
    const interval = CronExpressionParser.parse(cronExpression, {
      currentDate: now,
    });

    // Get the most recent fire time before `now`
    const prevFireTime = interval.prev().toDate();

    // Due if the previous fire time is after the last run
    return prevFireTime > lastRunAt;
  } catch {
    // Invalid cron expression — skip this schedule
    return false;
  }
}
