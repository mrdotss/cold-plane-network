import "server-only";

import { assumeRole } from "./aws-connection";
import {
  updateScanStatus,
  insertRecommendations,
} from "./queries";
import { createConversation } from "@/lib/chat/agent-client";
import { getBearerToken } from "@/lib/sizing/agent-client";
import { db } from "@/lib/db/client";
import { cfmScans, cfmAccounts } from "@/lib/db/schema";
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
}): string {
  return `You are analyzing an AWS account for cost optimization opportunities.

## Account Context
- AWS Account ID: ${account.awsAccountId}
- Regions to analyze: ${account.regions.join(", ")}
- Services to analyze: ${account.services.join(", ")}

## Instructions
Analyze each of the specified services across the specified regions. For each service:
1. Identify underutilized, idle, or over-provisioned resources
2. Calculate current monthly spend and potential savings
3. Classify each recommendation by priority (critical/medium/low) and effort (low/medium/high)
4. Include specific resource IDs and names in your findings

Provide your analysis service by service. For each service, return a structured JSON block:
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
Help the user understand the recommendations, answer questions about specific resources, suggest implementation steps, and provide additional analysis if requested. You have access to the customer's AWS account via CFM MCP tools — use them to look up additional details when the user asks.`;
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

/**
 * Extract structured service result blocks from the agent's text response.
 * The agent returns markdown with fenced JSON blocks — one per service.
 * Gracefully handles malformed blocks by skipping them.
 */
export function parseScanResults(agentResponse: string): AgentServiceResult[] {
  const results: AgentServiceResult[] = [];

  // Match fenced JSON code blocks (```json ... ``` or ``` ... ```)
  const jsonBlockRegex = /```(?:json)?\s*\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;

  while ((match = jsonBlockRegex.exec(agentResponse)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      if (parsed && typeof parsed.service === "string" && Array.isArray(parsed.recommendations)) {
        results.push({
          service: parsed.service,
          resources_analyzed: typeof parsed.resources_analyzed === "number" ? parsed.resources_analyzed : 0,
          recommendations: parsed.recommendations.map((r: Record<string, unknown>) => ({
            resourceId: String(r.resourceId ?? "unknown"),
            resourceName: r.resourceName != null ? String(r.resourceName) : undefined,
            priority: normalizePriority(String(r.priority ?? "low")),
            recommendation: String(r.recommendation ?? ""),
            currentCost: Number(r.currentCost) || 0,
            estimatedSavings: Number(r.estimatedSavings) || 0,
            effort: normalizeEffort(String(r.effort ?? "medium")),
            metadata: (r.metadata && typeof r.metadata === "object") ? r.metadata as Record<string, unknown> : {},
          })),
        });
      }
    } catch {
      // Skip malformed JSON blocks
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
    await assumeRole(account.roleArn, account.externalId);

    // 2. Transition: pending → running
    await updateScanStatus(scanId, "running");

    // 3. Create a new Azure conversation for this scan
    const conversationId = await createConversation();

    // Update scan with conversation ID for future deep-dive chat continuity
    await db
      .update(cfmScans)
      .set({ azureConversationId: conversationId })
      .where(eq(cfmScans.id, scanId));

    // 4. Build and send the analysis prompt
    const prompt = buildScanPrompt(account);

    // Emit service_started events for all services
    for (const service of account.services) {
      onProgress?.({ type: "service_started", service });
    }

    // 5. Call the agent (non-streaming — we need the full response to parse JSON blocks)
    const agentResponse = await callAgentForScan(conversationId, prompt);

    // 6. Parse structured results from the agent response
    const serviceResults = parseScanResults(agentResponse);
    const parsedServiceNames = new Set(serviceResults.map((r) => r.service));

    // 7. Persist recommendations per service and emit progress
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

    // 8. Mark services that the agent didn't return results for as failed
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

    // 9. Build summary and complete the scan
    const summary = buildSummary(serviceResults);

    await updateScanStatus(scanId, "completed", summary);

    // Update account's lastScanAt
    await db
      .update(cfmAccounts)
      .set({ lastScanAt: new Date(), updatedAt: new Date() })
      .where(eq(cfmAccounts.id, account.id));

    onProgress?.({ type: "scan_complete", summary });
  } catch (err) {
    // Fatal failure: STS, agent connection, or unrecoverable error
    const errorMessage = err instanceof Error ? err.message : "Scan failed";
    await updateScanStatus(scanId, "failed", undefined, errorMessage);
    onProgress?.({ type: "scan_failed", error: errorMessage });
  }
}
