import "server-only";

import { db } from "@/lib/db/client";
import { cfmScans, cspScans, awsAccounts } from "@/lib/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { createNotification } from "./service";
import { writeAuditEvent } from "@/lib/audit/writer";
import { getBearerToken } from "@/lib/sizing/agent-client";

// ─── Types ───────────────────────────────────────────────────────────────────

interface CfmSummary {
  totalMonthlySpend: number;
  totalPotentialSavings: number;
  recommendationCount: number;
}

interface CspSummary {
  totalFindings: number;
  severityBreakdown: { critical: number; high: number; medium: number; low: number };
  securityScore: number;
}

interface AccountDelta {
  accountId: string;
  accountName: string;
  cfm: {
    spendChange: number | null;
    savingsChange: number | null;
    newRecommendations: number | null;
    currentSavings: number;
    currentSpend: number;
  } | null;
  csp: {
    scoreChange: number | null;
    findingChange: number | null;
    currentScore: number;
    currentFindings: number;
  } | null;
  excluded: boolean;
  excludeReason?: string;
}

export interface DigestResult {
  notificationId: string;
  accountCount: number;
  excludedCount: number;
}

// ─── Delta Computation ───────────────────────────────────────────────────────

/**
 * Compute deltas between the latest two completed scans for an account.
 * Exported for unit testing.
 */
export function computeCfmDelta(
  scans: Array<{ summary: unknown; completedAt: Date | null }>,
): AccountDelta["cfm"] {
  if (scans.length < 1) return null;

  const current = scans[0].summary as CfmSummary | null;
  if (!current) return null;

  const result = {
    currentSpend: current.totalMonthlySpend,
    currentSavings: current.totalPotentialSavings,
    spendChange: null as number | null,
    savingsChange: null as number | null,
    newRecommendations: null as number | null,
  };

  if (scans.length >= 2) {
    const previous = scans[1].summary as CfmSummary | null;
    if (previous) {
      result.spendChange = previous.totalMonthlySpend > 0
        ? ((current.totalMonthlySpend - previous.totalMonthlySpend) / previous.totalMonthlySpend) * 100
        : 0;
      result.savingsChange = current.totalPotentialSavings - previous.totalPotentialSavings;
      result.newRecommendations = current.recommendationCount - previous.recommendationCount;
    }
  }

  return result;
}

export function computeCspDelta(
  scans: Array<{ summary: unknown; completedAt: Date | null }>,
): AccountDelta["csp"] {
  if (scans.length < 1) return null;

  const current = scans[0].summary as CspSummary | null;
  if (!current) return null;

  const result = {
    currentScore: current.securityScore,
    currentFindings: current.totalFindings,
    scoreChange: null as number | null,
    findingChange: null as number | null,
  };

  if (scans.length >= 2) {
    const previous = scans[1].summary as CspSummary | null;
    if (previous) {
      result.scoreChange = current.securityScore - previous.securityScore;
      result.findingChange = current.totalFindings - previous.totalFindings;
    }
  }

  return result;
}

// ─── Agent Call ──────────────────────────────────────────────────────────────

async function callAgentForDigest(deltaMarkdown: string): Promise<string> {
  const endpoint = process.env.AZURE_EXISTING_AIPROJECT_ENDPOINT;
  const agentName = process.env.AZURE_EXISTING_AGENT_ID;

  if (!endpoint || !agentName) {
    throw new Error("Agent service unavailable");
  }

  const token = await getBearerToken();
  const baseURL = `${endpoint}/openai/v1`;

  const prompt = `You are an AWS cloud insights analyst. Generate a concise weekly digest summary in markdown format based on the following account delta data. Cover: cost changes, new recommendations, security score changes, new/resolved findings. Keep it to 3-5 bullet points.\n\n${deltaMarkdown}`;

  const res = await fetch(`${baseURL}/responses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      input: [{ type: "message", role: "user", content: prompt }],
      agent_reference: { name: agentName, type: "agent_reference" },
      stream: false,
    }),
  });

  if (!res.ok) {
    throw new Error(`Agent request failed: ${res.status}`);
  }

  const data = await res.json();
  let fullText = "";
  if (Array.isArray(data.output)) {
    for (const item of data.output) {
      if (item.type === "message" && Array.isArray(item.content)) {
        for (const part of item.content) {
          if (part.type === "output_text" && typeof part.text === "string") {
            fullText += part.text;
          }
        }
      }
    }
  }

  return fullText || "AI summary unavailable";
}

// ─── Digest Generator ────────────────────────────────────────────────────────

/**
 * Generate a weekly digest for a user.
 * Queries latest 2 completed scans per account, computes deltas,
 * calls cpn-agent for markdown summary, creates digest_summary notification.
 */
export async function generateDigest(
  userId: string,
  accountIds?: string[],
  triggerType: "manual" | "scheduled" = "manual",
): Promise<DigestResult> {
  // 1. Get user's accounts
  let accountFilter = eq(awsAccounts.userId, userId);
  const accounts = await db
    .select({
      id: awsAccounts.id,
      accountName: awsAccounts.accountName,
    })
    .from(awsAccounts)
    .where(
      accountIds && accountIds.length > 0
        ? and(accountFilter, inArray(awsAccounts.id, accountIds))
        : accountFilter,
    );

  if (accounts.length === 0) {
    const notificationId = await createNotification(
      userId,
      "digest_summary",
      "Weekly Digest — No accounts",
      "No AWS accounts found. Connect an account to start receiving digest summaries.",
      {
        periodStart: new Date(Date.now() - 7 * 86400_000).toISOString().split("T")[0],
        periodEnd: new Date().toISOString().split("T")[0],
        spendDelta: 0,
        newFindings: 0,
        scoreChange: 0,
      },
    );

    return { notificationId, accountCount: 0, excludedCount: 0 };
  }

  // 2. Query latest 2 completed scans per account
  const deltas: AccountDelta[] = [];
  let excludedCount = 0;

  for (const account of accounts) {
    const [cfmScanRows, cspScanRows] = await Promise.all([
      db
        .select({ summary: cfmScans.summary, completedAt: cfmScans.completedAt })
        .from(cfmScans)
        .where(and(eq(cfmScans.accountId, account.id), eq(cfmScans.status, "completed")))
        .orderBy(desc(cfmScans.completedAt))
        .limit(2),
      db
        .select({ summary: cspScans.summary, completedAt: cspScans.completedAt })
        .from(cspScans)
        .where(and(eq(cspScans.accountId, account.id), eq(cspScans.status, "completed")))
        .orderBy(desc(cspScans.completedAt))
        .limit(2),
    ]);

    const cfmDelta = computeCfmDelta(cfmScanRows);
    const cspDelta = computeCspDelta(cspScanRows);

    const hasTwoScans = cfmScanRows.length >= 2 || cspScanRows.length >= 2;

    if (!hasTwoScans && cfmScanRows.length < 2 && cspScanRows.length < 2) {
      excludedCount++;
      deltas.push({
        accountId: account.id,
        accountName: account.accountName,
        cfm: cfmDelta,
        csp: cspDelta,
        excluded: true,
        excludeReason: "Fewer than 2 completed scans",
      });
    } else {
      deltas.push({
        accountId: account.id,
        accountName: account.accountName,
        cfm: cfmDelta,
        csp: cspDelta,
        excluded: false,
      });
    }
  }

  // 3. Build delta markdown for agent
  const periodEnd = new Date();
  const periodStart = new Date(Date.now() - 7 * 86400_000);
  const deltaMarkdown = buildDeltaMarkdown(deltas, periodStart, periodEnd);

  // 4. Call agent for summary (with fallback)
  let digestBody: string;
  try {
    digestBody = await callAgentForDigest(deltaMarkdown);
  } catch {
    digestBody = buildFallbackDigest(deltas, periodStart, periodEnd);
  }

  // 5. Compute aggregate metadata
  let totalSpendDelta = 0;
  let totalNewFindings = 0;
  let totalScoreChange = 0;
  let scoreCount = 0;

  for (const d of deltas) {
    if (d.excluded) continue;
    if (d.cfm?.spendChange != null) totalSpendDelta += d.cfm.spendChange;
    if (d.csp?.findingChange != null) totalNewFindings += d.csp.findingChange;
    if (d.csp?.scoreChange != null) {
      totalScoreChange += d.csp.scoreChange;
      scoreCount++;
    }
  }

  const avgScoreChange = scoreCount > 0 ? Math.round(totalScoreChange / scoreCount) : 0;

  // 6. Create digest notification
  const notificationId = await createNotification(
    userId,
    "digest_summary",
    `Weekly Digest — ${periodStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })}–${periodEnd.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
    digestBody,
    {
      periodStart: periodStart.toISOString().split("T")[0],
      periodEnd: periodEnd.toISOString().split("T")[0],
      spendDelta: Math.round(totalSpendDelta * 100) / 100,
      newFindings: totalNewFindings,
      scoreChange: avgScoreChange,
    },
  );

  // 7. Log audit event
  await writeAuditEvent({
    userId,
    eventType: "NOTIFICATION_DIGEST_TRIGGERED",
    metadata: {
      triggerType,
      accountCount: accounts.length,
    },
  });

  return {
    notificationId,
    accountCount: accounts.length,
    excludedCount,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildDeltaMarkdown(
  deltas: AccountDelta[],
  periodStart: Date,
  periodEnd: Date,
): string {
  const lines: string[] = [
    `# Weekly Digest Data — ${periodStart.toISOString().split("T")[0]} to ${periodEnd.toISOString().split("T")[0]}`,
    "",
  ];

  for (const d of deltas) {
    lines.push(`## ${d.accountName}`);
    if (d.excluded) {
      lines.push(`*Excluded: ${d.excludeReason}*`);
      lines.push("");
      continue;
    }

    if (d.cfm) {
      lines.push(`### Cost (CFM)`);
      lines.push(`- Current monthly spend: $${d.cfm.currentSpend.toFixed(2)}`);
      lines.push(`- Potential savings: $${d.cfm.currentSavings.toFixed(2)}`);
      if (d.cfm.spendChange != null) lines.push(`- Spend change: ${d.cfm.spendChange > 0 ? "+" : ""}${d.cfm.spendChange.toFixed(1)}%`);
      if (d.cfm.newRecommendations != null) lines.push(`- New recommendations: ${d.cfm.newRecommendations > 0 ? "+" : ""}${d.cfm.newRecommendations}`);
    }

    if (d.csp) {
      lines.push(`### Security (CSP)`);
      lines.push(`- Security score: ${d.csp.currentScore}/100`);
      lines.push(`- Total findings: ${d.csp.currentFindings}`);
      if (d.csp.scoreChange != null) lines.push(`- Score change: ${d.csp.scoreChange > 0 ? "+" : ""}${d.csp.scoreChange}`);
      if (d.csp.findingChange != null) lines.push(`- Finding change: ${d.csp.findingChange > 0 ? "+" : ""}${d.csp.findingChange}`);
    }

    lines.push("");
  }

  return lines.join("\n");
}

function buildFallbackDigest(
  deltas: AccountDelta[],
  periodStart: Date,
  periodEnd: Date,
): string {
  const active = deltas.filter((d) => !d.excluded);
  const excluded = deltas.filter((d) => d.excluded);

  const lines: string[] = [
    `## Weekly Digest — ${periodStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })}–${periodEnd.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
    "",
    "*AI summary unavailable — showing raw data.*",
    "",
  ];

  for (const d of active) {
    lines.push(`**${d.accountName}**`);
    if (d.cfm) lines.push(`- Cost: $${d.cfm.currentSpend.toFixed(0)}/mo, $${d.cfm.currentSavings.toFixed(0)} potential savings`);
    if (d.csp) lines.push(`- Security: ${d.csp.currentScore}/100, ${d.csp.currentFindings} findings`);
    lines.push("");
  }

  if (excluded.length > 0) {
    lines.push(`*${excluded.length} account(s) excluded due to insufficient scan data.*`);
  }

  return lines.join("\n");
}
