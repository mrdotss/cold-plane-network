import "server-only";

import { db } from "@/lib/db/client";
import { cfmScans, cspScans, cspFindings } from "@/lib/db/schema";
import { eq, and, sql, desc, count } from "drizzle-orm";

// ─── Types ───────────────────────────────────────────────────────────────────

export type ForecastMetric = "spend" | "security_score" | "finding_count";
export type ForecastTrend = "up" | "down" | "stable";

export interface ForecastDataPoint {
  date: string; // ISO date (YYYY-MM-DD)
  value: number;
}

export interface ForecastResponse {
  history: ForecastDataPoint[];
  forecast: ForecastDataPoint[];
  trend: ForecastTrend;
  changePercent: number;
  message?: string;
}

// ─── Linear Regression ───────────────────────────────────────────────────────

/**
 * Least-squares linear regression: y = mx + b.
 * Exported for property-based testing.
 */
export function linearRegression(
  points: Array<{ x: number; y: number }>,
): { m: number; b: number } {
  const n = points.length;
  if (n === 0) return { m: 0, b: 0 };
  if (n === 1) return { m: 0, b: points[0].y };

  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (const p of points) {
    sumX += p.x;
    sumY += p.y;
    sumXY += p.x * p.y;
    sumX2 += p.x * p.x;
  }

  const denom = n * sumX2 - sumX * sumX;
  if (Math.abs(denom) < 1e-10) {
    // All x values are the same — flat line at mean y
    return { m: 0, b: sumY / n };
  }

  const m = (n * sumXY - sumX * sumY) / denom;
  const b = (sumY - m * sumX) / n;
  return { m, b };
}

// ─── Trend Classification ────────────────────────────────────────────────────

/**
 * Classify trend based on change percent.
 * Exported for property-based testing.
 */
export function classifyTrend(changePercent: number): ForecastTrend {
  if (changePercent >= 5) return "up";
  if (changePercent <= -5) return "down";
  return "stable";
}

// ─── Forecast Engine ─────────────────────────────────────────────────────────

/**
 * Compute forecast for a given account, metric, and horizon.
 * Queries completed scans filtered by userId and accountId.
 */
export async function computeForecast(
  accountId: string,
  userId: string,
  metric: ForecastMetric,
  horizon: number = 30,
): Promise<ForecastResponse> {
  // 1. Fetch historical data points
  const history = await fetchHistoricalData(accountId, userId, metric);

  // 2. Not enough data
  if (history.length < 2) {
    return {
      history,
      forecast: [],
      trend: "stable",
      changePercent: 0,
      message: "Not enough data for forecasting",
    };
  }

  // 3. Build regression points (x = days since first point)
  const baseDate = new Date(history[0].date).getTime();
  const msPerDay = 86400_000;
  const regressionPoints = history.map((p) => ({
    x: (new Date(p.date).getTime() - baseDate) / msPerDay,
    y: p.value,
  }));

  const { m, b } = linearRegression(regressionPoints);

  // 4. Project forecast points
  const lastX = regressionPoints[regressionPoints.length - 1].x;
  const forecast: ForecastDataPoint[] = [];
  const lastDate = new Date(history[history.length - 1].date);

  for (let day = 1; day <= horizon; day++) {
    const forecastDate = new Date(lastDate.getTime() + day * msPerDay);
    const x = lastX + day;
    const value = Math.max(0, m * x + b); // clamp to 0
    forecast.push({
      date: forecastDate.toISOString().split("T")[0],
      value: Math.round(value * 100) / 100,
    });
  }

  // 5. Compute change percent
  const firstValue = history[0].value;
  const lastValue = history[history.length - 1].value;
  const changePercent = firstValue > 0
    ? ((lastValue - firstValue) / firstValue) * 100
    : 0;

  return {
    history,
    forecast,
    trend: classifyTrend(changePercent),
    changePercent: Math.round(changePercent * 100) / 100,
  };
}

// ─── Data Fetching ───────────────────────────────────────────────────────────

async function fetchHistoricalData(
  accountId: string,
  userId: string,
  metric: ForecastMetric,
): Promise<ForecastDataPoint[]> {
  switch (metric) {
    case "spend":
      return fetchSpendData(accountId, userId);
    case "security_score":
      return fetchSecurityScoreData(accountId, userId);
    case "finding_count":
      return fetchFindingCountData(accountId, userId);
  }
}

async function fetchSpendData(
  accountId: string,
  userId: string,
): Promise<ForecastDataPoint[]> {
  const rows = await db
    .select({
      date: cfmScans.completedAt,
      summary: cfmScans.summary,
    })
    .from(cfmScans)
    .where(
      and(
        eq(cfmScans.accountId, accountId),
        eq(cfmScans.userId, userId),
        eq(cfmScans.status, "completed"),
      ),
    )
    .orderBy(cfmScans.completedAt);

  return rows
    .filter((r) => r.date && r.summary)
    .map((r) => {
      const summary = r.summary as { totalMonthlySpend?: number } | null;
      return {
        date: r.date!.toISOString().split("T")[0],
        value: summary?.totalMonthlySpend ?? 0,
      };
    });
}

async function fetchSecurityScoreData(
  accountId: string,
  userId: string,
): Promise<ForecastDataPoint[]> {
  const rows = await db
    .select({
      date: cspScans.completedAt,
      score: sql<number>`(${cspScans.summary}->>'securityScore')::integer`,
    })
    .from(cspScans)
    .where(
      and(
        eq(cspScans.accountId, accountId),
        eq(cspScans.userId, userId),
        eq(cspScans.status, "completed"),
      ),
    )
    .orderBy(cspScans.completedAt);

  return rows
    .filter((r) => r.date && r.score != null)
    .map((r) => ({
      date: r.date!.toISOString().split("T")[0],
      value: r.score,
    }));
}

async function fetchFindingCountData(
  accountId: string,
  userId: string,
): Promise<ForecastDataPoint[]> {
  const rows = await db
    .select({
      date: cspScans.completedAt,
      findingCount: count(cspFindings.id),
    })
    .from(cspScans)
    .leftJoin(cspFindings, eq(cspFindings.scanId, cspScans.id))
    .where(
      and(
        eq(cspScans.accountId, accountId),
        eq(cspScans.userId, userId),
        eq(cspScans.status, "completed"),
      ),
    )
    .groupBy(cspScans.id, cspScans.completedAt)
    .orderBy(cspScans.completedAt);

  return rows
    .filter((r) => r.date)
    .map((r) => ({
      date: r.date!.toISOString().split("T")[0],
      value: r.findingCount,
    }));
}
