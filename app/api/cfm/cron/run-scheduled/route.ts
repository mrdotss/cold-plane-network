import { NextRequest, NextResponse } from "next/server";
import { executeScheduledScans } from "@/lib/cfm/scheduler";

/**
 * Cron endpoint for executing due scheduled CFM scans.
 *
 * Secured via CRON_SECRET header check:
 * - Vercel Cron automatically sends the secret in the Authorization header
 * - For self-hosted, pass the secret in the x-cron-secret header
 *
 * Schedule: `0 * * * *` (every hour, checks for due schedules)
 */
export async function GET(req: NextRequest) {
  try {
    // Verify cron secret
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = req.headers.get("authorization");
      const cronHeader = req.headers.get("x-cron-secret");
      const providedSecret =
        authHeader?.replace("Bearer ", "") ?? cronHeader;

      if (providedSecret !== cronSecret) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const result = await executeScheduledScans();

    return NextResponse.json({
      message: "Scheduled scans processed",
      ...result,
    });
  } catch (err) {
    console.error("Cron execution failed:", err);
    return NextResponse.json(
      { error: "Failed to execute scheduled scans" },
      { status: 500 },
    );
  }
}
