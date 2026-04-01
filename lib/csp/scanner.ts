import "server-only";

import { assumeRole } from "@/lib/aws/connection";
import {
  collectSecurityData,
  formatSecurityData,
} from "./aws-security-collector";
import { evaluateSecurityRules } from "./security-rules";
import {
  updateCspScanStatus,
  insertCspFindings,
  syncCspTrackingAfterScan,
} from "./queries";
import { createConversation } from "@/lib/chat/agent-client";
import { getBearerToken } from "@/lib/sizing/agent-client";
import { db } from "@/lib/db/client";
import { cspScans, awsAccounts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type {
  CspCategory,
  CspFindingInput,
  CspScanSummary,
  CspScanProgressEvent,
} from "./types";
import { CSP_CATEGORIES } from "./types";

// ─── Types ─────────────────────────────────────────────────────────────────

interface CspAccount {
  id: string;
  awsAccountId: string;
  roleArn: string;
  externalId: string | null;
  regions: string[];
}

export type CspProgressCallback = (event: CspScanProgressEvent) => void;

// ─── Agent Communication ───────────────────────────────────────────────────

function getBaseURL(): string {
  const endpoint = process.env.AZURE_EXISTING_AIPROJECT_ENDPOINT;
  if (!endpoint) {
    throw new Error(
      "Agent service unavailable: AZURE_EXISTING_AIPROJECT_ENDPOINT not set",
    );
  }
  return `${endpoint}/openai/v1`;
}

function getAgentName(): string {
  const agentName = process.env.AZURE_EXISTING_AGENT_ID;
  if (!agentName) {
    throw new Error(
      "Agent service unavailable: AZURE_EXISTING_AGENT_ID not set",
    );
  }
  return agentName;
}

async function callAgentForEnrichment(
  conversationId: string,
  prompt: string,
): Promise<string> {
  const baseURL = getBaseURL();
  const agentName = getAgentName();
  const token = await getBearerToken();

  const input = [{ type: "message", role: "user", content: prompt }];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const requestBody: Record<string, any> = {
    input,
    agent_reference: { name: agentName, type: "agent_reference" },
    stream: false,
  };

  if (!conversationId.startsWith("local-")) {
    requestBody.conversation = conversationId;
  }

  const res = await fetch(`${baseURL}/responses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(
      `Agent request failed: ${res.status} ${errText.slice(0, 300)}`,
    );
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

  return fullText;
}

// ─── Prompt Builder ────────────────────────────────────────────────────────

function buildEnrichmentPrompt(
  account: CspAccount,
  securityDataMarkdown: string,
  baseFindings: CspFindingInput[],
): string {
  return `You are a cloud security posture analyst. You have been provided with pre-collected security configuration data from an AWS account and a set of deterministic security findings.

## Account Context
- AWS Account ID: ${account.awsAccountId}
- Regions analyzed: ${account.regions.join(", ")}

## Pre-Collected Security Data

${securityDataMarkdown}

## Deterministic Findings (${baseFindings.length} total)

\`\`\`json
${JSON.stringify(baseFindings, null, 2)}
\`\`\`

## Instructions

Review each finding and enrich it with:
1. **Detailed remediation steps** — specific AWS CLI commands or console steps
2. **CIS AWS Benchmark references** — add or correct CIS reference numbers (e.g., "1.4", "2.1.1", "3.1")
3. **Risk context** — why this finding matters and potential impact

Return the enriched findings as a JSON array. Each object must have these fields:
\`\`\`json
{
  "category": "identity_access|network|data_protection|logging|external_access",
  "service": "IAM|EC2|S3|CloudTrail|VPC|Config|AccessAnalyzer",
  "resourceId": "<from original finding>",
  "resourceName": "<from original finding>",
  "severity": "critical|high|medium|low",
  "finding": "<enriched description with risk context>",
  "remediation": "<detailed step-by-step remediation>",
  "cisReference": "<CIS benchmark reference or null>",
  "metadata": {}
}
\`\`\`

Keep original resourceId values unchanged. You may adjust severity if you have strong justification. Return ALL findings, enriched.`;
}

// ─── Result Parser ─────────────────────────────────────────────────────────

function parseEnrichedFindings(agentResponse: string): CspFindingInput[] {
  const results: CspFindingInput[] = [];

  // Strategy 1: fenced JSON blocks
  const jsonBlockRegex = /```(?:json)?\s*\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;

  while ((match = jsonBlockRegex.exec(agentResponse)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          const finding = validateFindingInput(item);
          if (finding) results.push(finding);
        }
      }
    } catch { /* skip malformed */ }
  }

  // Strategy 2: raw JSON array
  if (results.length === 0) {
    const trimmed = agentResponse.trim();
    const jsonStart = trimmed.search(/[\[{]/);
    if (jsonStart >= 0) {
      try {
        const parsed = JSON.parse(trimmed.slice(jsonStart));
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            const finding = validateFindingInput(item);
            if (finding) results.push(finding);
          }
        }
      } catch { /* skip */ }
    }
  }

  return results;
}

function validateFindingInput(obj: unknown): CspFindingInput | null {
  if (!obj || typeof obj !== "object") return null;
  const o = obj as Record<string, unknown>;

  if (
    typeof o.category !== "string" ||
    typeof o.service !== "string" ||
    typeof o.resourceId !== "string" ||
    typeof o.severity !== "string" ||
    typeof o.finding !== "string" ||
    typeof o.remediation !== "string"
  ) {
    return null;
  }

  const validCategories = new Set([
    "identity_access",
    "network",
    "data_protection",
    "logging",
    "external_access",
  ]);
  const validSeverities = new Set(["critical", "high", "medium", "low"]);

  return {
    category: (validCategories.has(o.category)
      ? o.category
      : "identity_access") as CspCategory,
    service: o.service,
    resourceId: o.resourceId,
    resourceName: typeof o.resourceName === "string" ? o.resourceName : undefined,
    severity: (validSeverities.has(o.severity)
      ? o.severity
      : "medium") as CspFindingInput["severity"],
    finding: o.finding,
    remediation: o.remediation,
    cisReference: typeof o.cisReference === "string" ? o.cisReference : undefined,
    metadata:
      o.metadata && typeof o.metadata === "object"
        ? (o.metadata as Record<string, unknown>)
        : undefined,
  };
}

// ─── Summary Builder ───────────────────────────────────────────────────────

function buildCspSummary(findings: CspFindingInput[]): CspScanSummary {
  const severityBreakdown = { critical: 0, high: 0, medium: 0, low: 0 };
  const categoryBreakdown: Record<CspCategory, number> = {
    identity_access: 0,
    network: 0,
    data_protection: 0,
    logging: 0,
    external_access: 0,
  };

  for (const f of findings) {
    severityBreakdown[f.severity]++;
    categoryBreakdown[f.category]++;
  }

  // Security score: exponential decay model
  // Each finding contributes diminishing penalty so large finding counts
  // don't instantly collapse to 0 (e.g. many SG rules shouldn't = score 0).
  // Formula: score = 100 * e^(-weightedSum / scaleFactor)
  // Scale factor 250 gives: 0 findings=100, few medium=~95, moderate=~80,
  // bad (10crit+30high)=~59, very bad (48crit+87high)=~19
  const weights = { critical: 5, high: 2, medium: 0.5, low: 0.1 };
  const weightedSum =
    severityBreakdown.critical * weights.critical +
    severityBreakdown.high * weights.high +
    severityBreakdown.medium * weights.medium +
    severityBreakdown.low * weights.low;

  const securityScore = Math.round(100 * Math.exp(-weightedSum / 250));

  return {
    totalFindings: findings.length,
    severityBreakdown,
    categoryBreakdown,
    securityScore,
  };
}

// ─── Scan Orchestrator ─────────────────────────────────────────────────────

/**
 * Run a full CSP scan for an account.
 *
 * Orchestrates: STS AssumeRole → collect security data → deterministic rules →
 * agent enrichment → persist findings → update scan status.
 */
export async function runCspScan(
  scanId: string,
  account: CspAccount,
  onProgress?: CspProgressCallback,
): Promise<void> {
  try {
    // 1. Assume the cross-account IAM role
    const stsCreds = await assumeRole(account.roleArn, account.externalId);

    // 2. Transition: pending → running
    await updateCspScanStatus(scanId, "running");

    // 3. Collect security data from all categories in parallel
    const categories = CSP_CATEGORIES.map((c) => c.id);
    for (const category of categories) {
      onProgress?.({ type: "category_started", category });
    }

    const collectedData = await collectSecurityData(
      stsCreds,
      account.regions as string[],
      (category, detail) => {
        console.log(`[CSP Scan ${scanId}] ${category}: ${detail}`);
        onProgress?.({ type: "category_collecting", category, detail });
      },
    );

    const securityDataMarkdown = formatSecurityData(collectedData);

    // Count total checks (approximation for progress)
    const totalChecks =
      collectedData.identityAccess.users.length +
      collectedData.network.securityGroups.length +
      collectedData.network.vpcs.length +
      collectedData.dataProtection.buckets.length +
      collectedData.logging.trails.length +
      collectedData.logging.configRecorders.length +
      collectedData.externalAccess.analyzers.length;

    onProgress?.({ type: "data_collected", checkCount: totalChecks });

    // 4. Run deterministic rules
    const baseFindings = evaluateSecurityRules(collectedData);
    console.log(
      `[CSP Scan ${scanId}] Rule engine produced ${baseFindings.length} findings`,
    );

    // 5. Create Azure conversation for enrichment
    const conversationId = await createConversation();
    await db
      .update(cspScans)
      .set({ azureConversationId: conversationId })
      .where(eq(cspScans.id, scanId));

    // 6. Enrich findings via AI agent
    let enrichedFindings: CspFindingInput[];

    if (baseFindings.length > 0) {
      const prompt = buildEnrichmentPrompt(
        account,
        securityDataMarkdown,
        baseFindings,
      );
      const agentResponse = await callAgentForEnrichment(
        conversationId,
        prompt,
      );
      enrichedFindings = parseEnrichedFindings(agentResponse);

      // Fallback: if agent enrichment produced fewer results, merge with base
      if (enrichedFindings.length < baseFindings.length) {
        const enrichedResourceIds = new Set(
          enrichedFindings.map((f) => f.resourceId),
        );
        for (const base of baseFindings) {
          if (!enrichedResourceIds.has(base.resourceId)) {
            enrichedFindings.push(base);
          }
        }
      }
    } else {
      enrichedFindings = [];
    }

    // 7. Persist findings per category
    for (const category of categories) {
      const categoryFindings = enrichedFindings.filter(
        (f) => f.category === category,
      );

      if (categoryFindings.length > 0) {
        await insertCspFindings(
          categoryFindings.map((f) => ({
            scanId,
            category: f.category,
            service: f.service,
            resourceId: f.resourceId,
            resourceName: f.resourceName,
            severity: f.severity,
            finding: f.finding,
            remediation: f.remediation,
            cisReference: f.cisReference,
            metadata: f.metadata,
          })),
        );
      }

      onProgress?.({
        type: "category_complete",
        category,
        findingCount: categoryFindings.length,
      });
    }

    // 8. Build summary and complete the scan
    const summary = buildCspSummary(enrichedFindings);
    await updateCspScanStatus(scanId, "completed", summary);

    // Update account's lastScanAt
    await db
      .update(awsAccounts)
      .set({ lastScanAt: new Date(), updatedAt: new Date() })
      .where(eq(awsAccounts.id, account.id));

    // 9. Sync finding lifecycle tracking
    const trackingInput = enrichedFindings.map((f) => ({
      resourceId: f.resourceId,
      service: f.service,
      category: f.category,
    }));
    await syncCspTrackingAfterScan(account.id, scanId, trackingInput).catch(
      () => {
        // Non-blocking
      },
    );

    onProgress?.({ type: "scan_complete", summary });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Scan failed";
    await updateCspScanStatus(scanId, "failed", undefined, errorMessage);
    onProgress?.({ type: "scan_failed", error: errorMessage });
  }
}

/**
 * Build the system prompt for deep dive chat on CSP findings.
 */
export function buildCspDeepDiveChatPrompt(context: {
  accountName: string;
  awsAccountId: string;
  category: string;
  regions: string[];
  findings: Array<{
    resourceId: string;
    resourceName?: string | null;
    severity: string;
    finding: string;
    remediation: string;
    cisReference?: string | null;
    metadata?: Record<string, unknown>;
  }>;
}): string {
  const categoryLabel =
    CSP_CATEGORIES.find((c) => c.id === context.category)?.label ??
    context.category;

  return `You are a cloud security specialist for AWS ${categoryLabel}. You are helping a user understand and remediate security findings in their AWS account.

## Context
- AWS Account: ${context.accountName} (${context.awsAccountId})
- Category: ${categoryLabel}
- Regions: ${context.regions.join(", ")}

## Current Findings
${JSON.stringify(context.findings, null, 2)}

## Instructions
Help the user understand the findings, answer questions about specific resources, provide step-by-step remediation guidance (AWS CLI commands, console steps), explain CIS benchmark references, and assess the risk of each finding. Base your analysis on the findings data provided above.`;
}
