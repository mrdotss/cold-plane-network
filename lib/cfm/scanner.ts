import "server-only";

import { assumeRole } from "@/lib/aws/connection";
import {
  collectAccountData,
  formatCollectedData,
} from "./aws-collector";
import {
  updateScanStatus,
  insertRecommendations,
  syncTrackingAfterScan,
  autoVerifyImplementedRecommendations,
} from "./queries";
import { createConversation } from "@/lib/chat/agent-client";
import { getBearerToken } from "@/lib/sizing/agent-client";
import { createNotification } from "@/lib/notifications/service";
import { verifySavings } from "@/lib/insights/savings-verifier";
import { db } from "@/lib/db/client";
import { cfmScans, awsAccounts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type {
  CfmAccount,
  CfmScanSummary,
  CfmServiceBreakdown,
  ScanProgressEvent,
} from "./types";

// ─── Scan State Machine ──────────────────────────────────────────────────────

/** Valid state transitions for the scan state machine. */
const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ["running", "failed"],
  running: ["completed", "failed"],
  completed: [],
  failed: [],
};

/**
 * Check if a state transition is valid per the scan state machine.
 * pending → running → completed|failed, pending → failed.
 * Terminal states (completed, failed) never transition.
 */
export function isValidTransition(from: string, to: string): boolean {
  if (!Object.prototype.hasOwnProperty.call(VALID_TRANSITIONS, from)) {
    return false;
  }
  return VALID_TRANSITIONS[from].includes(to);
}

// ─── Prompt Builder ──────────────────────────────────────────────────────────

/**
 * Build the analysis prompt sent to the cpn-agent.
 * MUST NOT reference specific MCP tool names — the agent autonomously selects tools.
 */
export function buildScanPrompt(account: {
  awsAccountId: string;
  regions: string[];
  services: string[];
}, collectedData: string): string {
  return `You are analyzing an AWS account for cost optimization opportunities.
You have been provided with pre-collected resource inventory data and cost metrics below. Use this data to produce your analysis — do NOT attempt to query AWS APIs yourself.

## Account Context
- AWS Account ID: ${account.awsAccountId}
- Regions analyzed: ${account.regions.join(", ")}
- Services analyzed: ${account.services.join(", ")}

## Pre-Collected AWS Data

${collectedData}

## Instructions
Using the resource data and cost metrics above, analyze each service for cost optimization opportunities:
1. Identify underutilized, idle, or over-provisioned resources based on the metrics provided
2. Calculate current monthly spend and potential savings using the Cost Explorer data and resource details
3. Classify each recommendation by priority (critical/medium/low) and effort (low/medium/high)
4. Use the actual resource IDs and names from the data above

For each service that has resources, return a structured JSON block:
\`\`\`json
{
  "service": "<service_name>",
  "resources_analyzed": <count>,
  "recommendations": [
    {
      "resourceId": "<aws_resource_id>",
      "resourceName": "<display_name_or_tag>",
      "priority": "critical|medium|low",
      "recommendation": "<action_description>",
      "currentCost": <monthly_cost>,
      "estimatedSavings": <monthly_savings>,
      "effort": "low|medium|high",
      "metadata": {}
    }
  ]
}
\`\`\`

If a service has resources but no optimization issues, still return a block with an empty recommendations array and the correct resources_analyzed count.

## Service-Specific Metadata Fields

The "metadata" object MUST include service-specific fields when available:

- **EC2**: \`{"currentType": "t3.large", "recommendedType": "t3.medium", "avgCpu": 12.5}\`
  - \`currentType\`: Current instance type (e.g., "m5.xlarge")
  - \`recommendedType\`: Suggested instance type for right-sizing (if applicable)
  - \`avgCpu\`: Average CPU utilization percentage from the provided metrics

- **RDS**: \`{"status": "idle", "connections": 0}\`
  - \`status\`: Instance status derived from metrics (e.g., "idle", "underutilized")
  - \`connections\`: Average database connections from the provided metrics

- **S3**: \`{"currentClass": "STANDARD", "recommendedClass": "INTELLIGENT_TIERING", "accessPattern": "infrequent"}\`
  - \`currentClass\`: Current storage class
  - \`recommendedClass\`: Recommended storage class
  - \`accessPattern\`: Access pattern (e.g., "frequent", "infrequent", "archive")

- **Lambda**: \`{"currentMemory": 512, "recommendedMemory": 256, "avgDuration": 150}\`
  - \`currentMemory\`: Current memory allocation in MB
  - \`recommendedMemory\`: Recommended memory in MB
  - \`avgDuration\`: Average invocation duration from the provided metrics

- **NAT Gateway / CloudWatch / other services**: Include any relevant metrics as key-value pairs.

Always populate metadata fields from the provided data. Do NOT leave metadata as an empty object if you have data available.

Analyze services one at a time. Do NOT skip any requested service.`;
}


// ─── Deep Dive Chat Prompt ────────────────────────────────────────────────

/**
 * Build the system prompt for the deep dive chat panel.
 * Includes service context and JSON representation of recommendations
 * so the agent can answer follow-up questions about specific resources.
 */
export function buildDeepDiveChatPrompt(context: {
  accountName: string;
  awsAccountId: string;
  serviceName: string;
  regions: string[];
  recommendations: Array<{
    resourceId: string;
    resourceName?: string | null;
    priority: string;
    recommendation: string;
    currentCost: number;
    estimatedSavings: number;
    effort: string;
    metadata?: Record<string, unknown>;
  }>;
}): string {
  return `You are a cost optimization specialist for AWS ${context.serviceName}. You are continuing a conversation about a customer's AWS account analysis.

## Context
- AWS Account: ${context.accountName} (${context.awsAccountId})
- Service: ${context.serviceName}
- Regions: ${context.regions.join(", ")}

## Current Findings
${JSON.stringify(context.recommendations, null, 2)}

## Instructions
Help the user understand the recommendations, answer questions about specific resources, suggest implementation steps, and provide additional analysis if requested. Use your CPN MCP tools (pricing lookups, CFM tips, cost explorer data) to provide detailed answers. Base your analysis on the findings data provided above.`;
}

// ─── Result Parser ───────────────────────────────────────────────────────────

/** Shape of a single service result block from the agent response. */
interface AgentServiceResult {
  service: string;
  resources_analyzed?: number;
  recommendations: Array<{
    resourceId: string;
    resourceName?: string;
    priority: string;
    recommendation: string;
    currentCost: number;
    estimatedSavings: number;
    effort: string;
    metadata?: Record<string, unknown>;
  }>;
}

/** Validate and normalize a single service result object */
function parseServiceResult(parsed: unknown): AgentServiceResult | null {
  if (!parsed || typeof parsed !== "object") return null;
  const obj = parsed as Record<string, unknown>;
  if (typeof obj.service !== "string" || !Array.isArray(obj.recommendations)) return null;

  return {
    service: obj.service,
    resources_analyzed: typeof obj.resources_analyzed === "number" ? obj.resources_analyzed : 0,
    recommendations: obj.recommendations.map((r: Record<string, unknown>) => ({
      resourceId: String(r.resourceId ?? "unknown"),
      resourceName: r.resourceName != null ? String(r.resourceName) : undefined,
      priority: normalizePriority(String(r.priority ?? "low")),
      recommendation: String(r.recommendation ?? ""),
      currentCost: Number(r.currentCost) || 0,
      estimatedSavings: Number(r.estimatedSavings) || 0,
      effort: normalizeEffort(String(r.effort ?? "medium")),
      metadata: (r.metadata && typeof r.metadata === "object") ? r.metadata as Record<string, unknown> : {},
    })),
  };
}

/**
 * Extract structured service result blocks from the agent's text response.
 * Supports multiple response formats:
 *   1. Markdown with fenced JSON blocks (```json ... ```)
 *   2. Raw JSON array of service objects
 *   3. Raw JSON single service object
 * Gracefully handles malformed blocks by skipping them.
 */
export function parseScanResults(agentResponse: string): AgentServiceResult[] {
  const results: AgentServiceResult[] = [];

  // Strategy 1: Match fenced JSON code blocks (```json ... ``` or ``` ... ```)
  const jsonBlockRegex = /```(?:json)?\s*\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;

  while ((match = jsonBlockRegex.exec(agentResponse)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      // Could be a single object or an array inside a fenced block
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          const result = parseServiceResult(item);
          if (result) results.push(result);
        }
      } else {
        const result = parseServiceResult(parsed);
        if (result) results.push(result);
      }
    } catch {
      // Skip malformed JSON blocks
    }
  }

  // Strategy 2: If no fenced blocks found, try parsing the entire response as JSON
  if (results.length === 0) {
    const trimmed = agentResponse.trim();
    // Look for JSON starting with [ or { anywhere in the response
    const jsonStart = trimmed.search(/[\[{]/);
    if (jsonStart >= 0) {
      const jsonCandidate = trimmed.slice(jsonStart);
      try {
        const parsed = JSON.parse(jsonCandidate);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            const result = parseServiceResult(item);
            if (result) results.push(result);
          }
        } else {
          const result = parseServiceResult(parsed);
          if (result) results.push(result);
        }
      } catch {
        // Strategy 3: Try to find individual JSON objects in the text
        // Match top-level { ... } blocks that look like service results
        const objectRegex = /\{[^{}]*"service"\s*:\s*"[^"]+?"[^{}]*"recommendations"\s*:\s*\[[\s\S]*?\]\s*\}/g;
        let objMatch: RegExpExecArray | null;
        while ((objMatch = objectRegex.exec(agentResponse)) !== null) {
          try {
            const result = parseServiceResult(JSON.parse(objMatch[0]));
            if (result) results.push(result);
          } catch {
            // Skip malformed objects
          }
        }
      }
    }
  }

  return results;
}

function normalizePriority(value: string): "critical" | "medium" | "low" {
  const v = value.toLowerCase().trim();
  if (v === "critical" || v === "high") return "critical";
  if (v === "medium" || v === "med") return "medium";
  return "low";
}

function normalizeEffort(value: string): "low" | "medium" | "high" {
  const v = value.toLowerCase().trim();
  if (v === "low") return "low";
  if (v === "high") return "high";
  return "medium";
}

// ─── Summary Builder ─────────────────────────────────────────────────────────

/**
 * Build a CfmScanSummary from parsed service results.
 */
export function buildSummary(
  serviceResults: AgentServiceResult[],
): CfmScanSummary {
  let totalMonthlySpend = 0;
  let totalPotentialSavings = 0;
  let recommendationCount = 0;
  const priorityBreakdown = { critical: 0, medium: 0, low: 0 };
  const serviceBreakdown: CfmServiceBreakdown[] = [];

  for (const result of serviceResults) {
    let serviceSpend = 0;
    let serviceSavings = 0;
    let hasCritical = false;
    const recTypes = new Set<string>();

    for (const rec of result.recommendations) {
      serviceSpend += rec.currentCost;
      serviceSavings += rec.estimatedSavings;
      recommendationCount++;

      const p = rec.priority as "critical" | "medium" | "low";
      priorityBreakdown[p] = (priorityBreakdown[p] ?? 0) + 1;

      if (p === "critical") hasCritical = true;

      // Derive recommendation type from the action text
      const recText = rec.recommendation.toLowerCase();
      if (recText.includes("right-siz") || recText.includes("downsize")) recTypes.add("right-sizing");
      else if (recText.includes("unused") || recText.includes("idle") || recText.includes("delete")) recTypes.add("unused");
      else if (recText.includes("reserved") || recText.includes("savings plan")) recTypes.add("commitment");
      else if (recText.includes("storage") || recText.includes("class") || recText.includes("tier")) recTypes.add("storage-optimization");
      else recTypes.add("optimization");
    }

    totalMonthlySpend += serviceSpend;
    totalPotentialSavings += serviceSavings;

    serviceBreakdown.push({
      service: result.service,
      currentSpend: serviceSpend,
      potentialSavings: serviceSavings,
      recommendationCount: result.recommendations.length,
      resourceCount: result.resources_analyzed ?? result.recommendations.length,
      hasCritical,
      recommendationTypes: Array.from(recTypes),
    });
  }

  return {
    totalMonthlySpend,
    totalPotentialSavings,
    recommendationCount,
    priorityBreakdown,
    serviceBreakdown,
  };
}


// ─── Agent Communication ─────────────────────────────────────────────────────

/**
 * Get the base URL for Azure AI Foundry API.
 */
function getBaseURL(): string {
  const endpoint = process.env.AZURE_EXISTING_AIPROJECT_ENDPOINT;
  if (!endpoint) {
    throw new Error("Agent service unavailable: AZURE_EXISTING_AIPROJECT_ENDPOINT not set");
  }
  return `${endpoint}/openai/v1`;
}

/**
 * Get the agent name from env vars.
 */
function getAgentName(): string {
  const agentName = process.env.AZURE_EXISTING_AGENT_ID;
  if (!agentName) {
    throw new Error("Agent service unavailable: AZURE_EXISTING_AGENT_ID not set");
  }
  return agentName;
}

/**
 * Send a non-streaming request to the Azure AI Foundry agent and collect the full response.
 * Used for scan analysis where we need the complete text to parse JSON blocks.
 */
async function callAgentForScan(
  conversationId: string,
  prompt: string,
): Promise<string> {
  const baseURL = getBaseURL();
  const agentName = getAgentName();
  const token = await getBearerToken();

  const input = [
    { type: "message", role: "user", content: prompt },
  ];

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
    throw new Error(`Agent request failed: ${res.status} ${errText.slice(0, 300)}`);
  }

  const data = await res.json();

  // Extract text content from the response output items
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

// ─── Scan Orchestrator ───────────────────────────────────────────────────────

/** Callback for emitting SSE progress events during a scan. */
export type ScanProgressCallback = (event: ScanProgressEvent) => void;

/**
 * Run a full CFM scan for an account.
 *
 * Orchestrates: STS AssumeRole → create conversation → agent analysis →
 * parse results → persist recommendations → update scan status.
 *
 * Handles partial failures: if individual services fail during parsing,
 * the scan still completes with results for successful services.
 *
 * Credentials are session-scoped and never persisted.
 */
export async function runScan(
  scanId: string,
  account: CfmAccount,
  onProgress?: ScanProgressCallback,
): Promise<void> {
  const failedServices: string[] = [];

  try {
    // 1. Assume the cross-account IAM role (credentials are scoped to this function)
    const stsCreds = await assumeRole(account.roleArn, account.externalId);

    // 2. Transition: pending → running
    await updateScanStatus(scanId, "running");

    // 3. Pre-fetch AWS resource data using assumed role credentials
    // Emit service_started events to show collection phase
    for (const service of account.services) {
      onProgress?.({ type: "service_started", service });
    }

    const collectedData = await collectAccountData(
      stsCreds,
      account.regions as string[],
      account.services as string[],
      (service, status) => {
        console.log(`[CFM Scan ${scanId}] Collecting ${service}: ${status}`);
        onProgress?.({ type: "service_collecting", service, detail: status });
      },
      (account as { costAllocationTags?: string[] }).costAllocationTags,
    );
    const formattedData = formatCollectedData(collectedData);

    // Notify that data collection is done, agent analysis begins
    const totalResources = collectedData.services.reduce(
      (sum, s) => sum + s.resources.length, 0,
    );
    onProgress?.({ type: "data_collected", resourceCount: totalResources });

    // 4. Create a new Azure conversation for this scan
    const conversationId = await createConversation();

    // Update scan with conversation ID for future deep-dive chat continuity
    await db
      .update(cfmScans)
      .set({ azureConversationId: conversationId })
      .where(eq(cfmScans.id, scanId));

    // 5. Build and send the analysis prompt (with pre-collected data)
    const prompt = buildScanPrompt(account, formattedData);

    // 6. Call the agent (non-streaming — we need the full response to parse JSON blocks)
    const agentResponse = await callAgentForScan(conversationId, prompt);

    // 7. Parse structured results from the agent response
    const serviceResults = parseScanResults(agentResponse);
    const parsedServiceNames = new Set(serviceResults.map((r) => r.service));

    // Diagnostic: warn if agent responded but no JSON blocks were parsed
    if (serviceResults.length === 0 && agentResponse.length > 0) {
      console.warn(
        `[CFM Scan ${scanId}] Agent returned ${agentResponse.length} chars but 0 parseable service blocks. ` +
        `First 500 chars: ${agentResponse.slice(0, 500)}`,
      );
    }

    // 8. Persist recommendations per service and emit progress
    for (const result of serviceResults) {
      try {
        if (result.recommendations.length > 0) {
          await insertRecommendations(
            result.recommendations.map((rec) => ({
              scanId,
              service: result.service,
              resourceId: rec.resourceId,
              resourceName: rec.resourceName,
              priority: rec.priority,
              recommendation: rec.recommendation,
              currentCost: rec.currentCost.toFixed(2),
              estimatedSavings: rec.estimatedSavings.toFixed(2),
              effort: rec.effort,
              metadata: rec.metadata,
            })),
          );
        }

        onProgress?.({
          type: "service_complete",
          service: result.service,
          summary: `${result.resources_analyzed ?? result.recommendations.length} resources analyzed · ${result.recommendations.length} recommendations`,
          recommendationCount: result.recommendations.length,
        });
      } catch (err) {
        // Partial failure: persist error for this service, continue with others
        failedServices.push(result.service);
        onProgress?.({
          type: "service_failed",
          service: result.service,
          error: err instanceof Error ? err.message : "Failed to persist recommendations",
        });
      }
    }

    // 9. Mark services that the agent didn't return results for as failed
    for (const service of account.services) {
      if (!parsedServiceNames.has(service) && !failedServices.includes(service)) {
        failedServices.push(service);
        onProgress?.({
          type: "service_failed",
          service,
          error: "No analysis results returned for this service",
        });
      }
    }

    // 10. Build summary and complete the scan
    const summary = buildSummary(serviceResults);

    // Attach tag breakdown if cost allocation tags were collected
    if (Object.keys(collectedData.costByTag).length > 0) {
      summary.tagBreakdown = collectedData.costByTag;
    }

    await updateScanStatus(scanId, "completed", summary);

    // Update account's lastScanAt
    await db
      .update(awsAccounts)
      .set({ lastScanAt: new Date(), updatedAt: new Date() })
      .where(eq(awsAccounts.id, account.id));

    // 11. Sync recommendation lifecycle tracking
    const allRecs = serviceResults.flatMap((r) =>
      r.recommendations.map((rec) => ({
        resourceId: rec.resourceId,
        service: r.service,
      })),
    );
    await syncTrackingAfterScan(account.id, scanId, allRecs).catch(() => {
      // Non-blocking: lifecycle sync failure should not fail the scan
    });

    // 12. Auto-verify implemented recommendations no longer flagged
    const currentResourceKeys = new Set(
      allRecs.map((r) => `${r.resourceId}::${r.service}`),
    );
    await autoVerifyImplementedRecommendations(
      account.id,
      scanId,
      currentResourceKeys,
    ).catch(() => {
      // Non-blocking: auto-verification failure should not fail the scan
    });

    // 12b. Verify savings for implemented recommendations
    verifySavings(account.id, scanId, account.userId).catch(() => {
      // Non-blocking: savings verification failure should not fail the scan
    });

    onProgress?.({ type: "scan_complete", summary });

    // 13. Fire-and-forget notification for scan completion
    createNotification(
      account.userId,
      "cfm_scan_complete",
      `CFM Scan Complete — $${summary.totalPotentialSavings.toFixed(0)} savings found`,
      `Scan completed for ${account.accountName}. Found ${summary.recommendationCount} recommendations with $${summary.totalPotentialSavings.toFixed(2)}/mo potential savings.`,
      {
        scanId,
        accountId: account.id,
        totalSavings: summary.totalPotentialSavings,
        recommendationCount: summary.recommendationCount,
      },
    ).catch(() => {});
  } catch (err) {
    // Fatal failure: STS, agent connection, or unrecoverable error
    const errorMessage = err instanceof Error ? err.message : "Scan failed";
    await updateScanStatus(scanId, "failed", undefined, errorMessage);
    onProgress?.({ type: "scan_failed", error: errorMessage });
  }
}
