import { NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth/middleware";
import { computeForecast } from "@/lib/insights/forecast";
import type { ForecastMetric } from "@/lib/insights/forecast";

const VALID_METRICS: ForecastMetric[] = ["spend", "security_score", "finding_count"];

/**
 * GET /api/insights/forecast
 *
 * Query params:
 *   - accountId (required)
 *   - metric (required): "spend" | "security_score" | "finding_count"
 *   - horizon (optional, default 30): forecast horizon in days
 *
 * Response: { history, forecast, trend, changePercent, message? }
 */
export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();

    const url = new URL(request.url);
    const accountId = url.searchParams.get("accountId");
    const metric = url.searchParams.get("metric") as ForecastMetric | null;
    const horizon = Math.max(
      1,
      Math.min(365, parseInt(url.searchParams.get("horizon") ?? "30", 10)),
    );

    if (!accountId) {
      return NextResponse.json(
        { error: "accountId is required" },
        { status: 400 },
      );
    }

    if (!metric || !VALID_METRICS.includes(metric)) {
      return NextResponse.json(
        { error: "Invalid metric. Must be spend, security_score, or finding_count" },
        { status: 400 },
      );
    }

    const result = await computeForecast(accountId, userId, metric, horizon);

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to compute forecast" },
      { status: 500 },
    );
  }
}
