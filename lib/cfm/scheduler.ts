import "server-only";

import {
  getDueSchedules,
  markScheduleRun,
  getAccountById,
  createScan,
} from "./queries";
import { runScan } from "./scanner";
import { writeAuditEvent } from "@/lib/audit/writer";
import type { ScheduleFrequency } from "./types";

/**
 * Compute the next run time given a schedule's frequency and preferences.
 *
 * @param frequency - "daily" | "weekly" | "monthly"
 * @param hour - Hour of day in UTC (0-23)
 * @param dayOfWeek - Day of week (0=Sunday, 6=Saturday), required for weekly
 * @param dayOfMonth - Day of month (1-28), required for monthly
 * @param from - Base date to compute from (defaults to now)
 */
export function computeNextRunAt(
  frequency: ScheduleFrequency,
  hour: number,
  dayOfWeek?: number | null,
  dayOfMonth?: number | null,
  from?: Date,
): Date {
  const base = from ? new Date(from) : new Date();
  const next = new Date(base);

  // Reset to the target hour, zero minutes/seconds
  next.setUTCMinutes(0, 0, 0);

  switch (frequency) {
    case "daily": {
      // Next occurrence of the target hour
      next.setUTCHours(hour);
      if (next <= base) {
        next.setUTCDate(next.getUTCDate() + 1);
      }
      break;
    }

    case "weekly": {
      const targetDay = dayOfWeek ?? 0;
      next.setUTCHours(hour);
      const currentDay = next.getUTCDay();
      let daysUntil = targetDay - currentDay;
      if (daysUntil < 0) daysUntil += 7;
      if (daysUntil === 0 && next <= base) daysUntil = 7;
      next.setUTCDate(next.getUTCDate() + daysUntil);
      break;
    }

    case "monthly": {
      const targetDate = dayOfMonth ?? 1;
      next.setUTCHours(hour);
      next.setUTCDate(targetDate);
      if (next <= base) {
        next.setUTCMonth(next.getUTCMonth() + 1);
        next.setUTCDate(targetDate);
      }
      break;
    }
  }

  return next;
}

/**
 * Execute all due scheduled scans.
 * Called by the cron endpoint.
 *
 * For each due schedule:
 * 1. Look up the account
 * 2. Create a scan record
 * 3. Fire-and-forget runScan (same as manual scan)
 * 4. Update schedule's lastRunAt and nextRunAt
 * 5. Log audit event
 *
 * @returns Summary of executed and failed schedules
 */
export async function executeScheduledScans(): Promise<{
  executed: number;
  failed: number;
}> {
  const dueSchedules = await getDueSchedules();
  let executed = 0;
  let failed = 0;

  for (const schedule of dueSchedules) {
    try {
      // Get the account — we need the full account object for runScan
      const account = await getAccountById(
        schedule.accountId,
        schedule.userId,
      );
      if (!account) {
        failed++;
        continue;
      }

      // Create a scan record
      const scan = await createScan(schedule.accountId, schedule.userId);

      // Compute next run time
      const nextRunAt = computeNextRunAt(
        schedule.frequency as ScheduleFrequency,
        schedule.hour,
        schedule.dayOfWeek,
        schedule.dayOfMonth,
      );

      // Update schedule
      await markScheduleRun(schedule.id, nextRunAt);

      // Fire-and-forget scan execution (same pattern as manual scan)
      runScan(scan.id, {
        id: account.id,
        userId: account.userId,
        accountName: account.accountName,
        awsAccountId: account.awsAccountId,
        roleArn: account.roleArn,
        externalId: account.externalId,
        regions: account.regions as string[],
        services: account.services as string[],
        lastScanAt: account.lastScanAt,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
      }).catch(() => {
        // Scan failures are handled internally by runScan (sets status to "failed")
      });

      // Audit log
      writeAuditEvent({
        userId: schedule.userId,
        eventType: "CFM_SCAN_SCHEDULED",
        metadata: {
          scanId: scan.id,
          accountId: schedule.accountId,
          scheduleId: schedule.id,
        },
      }).catch(() => {});

      executed++;
    } catch {
      failed++;
    }
  }

  return { executed, failed };
}
