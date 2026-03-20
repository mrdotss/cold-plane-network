import "server-only";

import { AIProjectClient } from "@azure/ai-projects";
import {
  DefaultAzureCredential,
  ClientSecretCredential,
} from "@azure/identity";
import type { TokenCredential } from "@azure/identity";
import type { AutofillServiceInput } from "./types";

/**
 * Azure AI Foundry scope for token acquisition.
 * Project endpoints (*.services.ai.azure.com/api/projects/*) require the
 * https://ai.azure.com audience — NOT the Cognitive Services audience.
 */
const AZURE_SCOPE = "https://ai.azure.com/.default";

/**
 * Resolve the Azure credential based on available env vars.
 * Prefers explicit ClientSecretCredential when all three vars are set,
 * otherwise falls back to DefaultAzureCredential (managed identity, CLI, etc.).
 */
export function getCredential(): TokenCredential {
  const tenantId = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;

  if (tenantId && clientId && clientSecret) {
    return new ClientSecretCredential(tenantId, clientId, clientSecret);
  }
  return new DefaultAzureCredential();
}

/**
 * Create an AIProjectClient instance.
 * Uses the AZURE_EXISTING_AIPROJECT_ENDPOINT env var.
 */
export function getClient(): AIProjectClient {
  const endpoint = process.env.AZURE_EXISTING_AIPROJECT_ENDPOINT;
  if (!endpoint) {
    throw new Error(
      "Agent service unavailable: AZURE_EXISTING_AIPROJECT_ENDPOINT not set"
    );
  }
  return new AIProjectClient(endpoint, getCredential());
}

/**
 * Get a bearer token for Azure AI Foundry API calls.
 * Uses getCredential() which prefers service principal, falls back to DefaultAzureCredential.
 */
export async function getBearerToken(): Promise<string> {
  const credential = getCredential();
  const tokenResponse = await credential.getToken(AZURE_SCOPE);
  if (!tokenResponse?.token) {
    throw new Error("Failed to acquire Azure access token");
  }
  return tokenResponse.token;
}

/**
 * Get the base URL for Azure AI Foundry Responses API.
 *
 * Azure AI Foundry project endpoints use `/openai/v1/` path (no api-version query param).
 * This was confirmed via endpoint testing — the `/v1` in the path IS the version.
 */
function getBaseURL(): string {
  const endpoint = process.env.AZURE_EXISTING_AIPROJECT_ENDPOINT;
  if (!endpoint) {
    throw new Error(
      "Agent service unavailable: AZURE_EXISTING_AIPROJECT_ENDPOINT not set"
    );
  }
  return `${endpoint}/openai/v1`;
}

/**
 * Make a direct fetch call to the Azure AI Foundry Responses API.
 *
 * We use fetch() directly instead of the OpenAI SDK because:
 * - The SDK strips/transforms request body params for `responses.create()`
 * - Azure AI Foundry agent_reference is not a standard OpenAI param
 * - Direct fetch gives us full control over the exact request body
 *
 * Auth: Always uses Azure AD bearer tokens (OBO required for agent MCP tools).
 * API keys are rejected: "Tools configured with OBO auth are not supported with API key authentication"
 */
async function agentFetch(
  body: Record<string, unknown>,
): Promise<globalThis.Response> {
  const baseURL = getBaseURL();
  const token = await getBearerToken();

  return fetch(`${baseURL}/responses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
}

/**
 * Get the agent name from env vars.
 */
function getAgentName(): string {
  const agentName = process.env.AZURE_EXISTING_AGENT_ID;
  if (!agentName) {
    throw new Error(
      "Agent service unavailable: AZURE_EXISTING_AGENT_ID not set"
    );
  }
  return agentName;
}

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

/**
 * Build the prompt that combines pricing context with user description.
 * Exported for testing (Property 6).
 */
export function buildAgentPrompt(
  pricingContext: string,
  userDescription: string
): string {
  return [
    "## AWS Pricing Calculator Export Data",
    pricingContext,
    "",
    "## User Request",
    userDescription,
  ].join("\n");
}

const TIER_DISPLAY: Record<string, string> = {
  onDemand: "On-Demand",
  ri1Year: "RI 1-Year",
  ri3Year: "RI 3-Year",
};

/**
 * Build the autofill prompt that asks the CPN Agent to provide missing pricing tiers.
 * Sends full service properties and current pricing for accuracy.
 * Does NOT instruct the agent to use MCP tools (avoids 429 rate limiting).
 * Exported for testing (Property 2 / Property 6).
 */
export function buildAutofillPrompt(
  services: AutofillServiceInput[],
  inputTier: string,
  missingTiers: string[]
): string {
  const serviceList = services
    .map((s, i) => {
      const propsLines = Object.entries(s.properties)
        .map(([key, val]) => `     - ${key}: ${val}`)
        .join("\n");
      const currentPricingLine = s.currentPricing
        ? `   Current Pricing (${TIER_DISPLAY[inputTier] ?? inputTier}): monthly=${s.currentPricing.monthly}, upfront=${s.currentPricing.upfront}, 12mo=${s.currentPricing.twelve_months}`
        : "";
      return [
        `${i + 1}. Service: ${s.serviceName}`,
        `   Description: ${s.description}`,
        `   Region: ${s.region}`,
        currentPricingLine,
        `   Properties:`,
        propsLines,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");

  const missingDisplay = missingTiers
    .map((t) => TIER_DISPLAY[t] ?? t)
    .join(", ");
  const inputDisplay = TIER_DISPLAY[inputTier] ?? inputTier;

  return [
    "## Pricing Tier Lookup Request",
    "",
    `The uploaded AWS Pricing Calculator estimate uses the **${inputDisplay}** pricing tier.`,
    `I need you to provide accurate pricing for the following missing tiers: **${missingDisplay}**.`,
    "",
    "### Services with Full Specifications",
    "",
    serviceList,
    "",
    "### Instructions",
    "",
    `For each service listed above, provide the ${missingDisplay} pricing (upfront and monthly costs).`,
    "IMPORTANT: Use the EXACT instance types, storage configurations, deployment options, operating systems, and license types from the Properties to look up accurate pricing.",
    "For example, if Properties shows 'Instance type: db.m5.4xlarge' with 'Database edition: Standard' and 'License: License included', look up the RI pricing for that EXACT configuration, not a generic estimate.",
    "For EC2, match the EXACT 'Advance EC2 instance' type (e.g., m5.xlarge) and 'Operating system' (e.g., Linux or Windows Server).",
    "Include storage costs (EBS, gp3 IOPS/throughput) in the pricing where applicable.",
    "Return ONLY valid JSON with no markdown wrapping or code fences.",
    "Use the following response schema:",
    "",
    "```",
    JSON.stringify(
      {
        services: [
          {
            service: "<service name>",
            description: "<description>",
            region: "<region>",
            ...Object.fromEntries(
              missingTiers.map((t) => [t, { upfront: 0, monthly: 0 }])
            ),
          },
        ],
      },
      null,
      2
    ),
    "```",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Agent calls via direct fetch (bypasses OpenAI SDK body transformation issues)
// ---------------------------------------------------------------------------

/**
 * Call the CPN Agent via the Responses API (non-streaming, stateless).
 * Used for autofill pricing lookups.
 * `store: false` ensures no conversation state is persisted in Azure.
 */
export async function callAgentSync(
  prompt: string,
  _userDescription: string = ""
): Promise<string> {
  const agentName = getAgentName();

  const res = await agentFetch({
    input: [{ role: "user", content: prompt }],
    agent_reference: { name: agentName, type: "agent_reference" },
    store: false,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Agent call failed (${res.status}): ${errText.slice(0, 300)}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = await res.json();
  if (data.output_text) return data.output_text;

  // Fall back to parsing output array
  if (Array.isArray(data.output)) {
    const texts: string[] = [];
    for (const item of data.output) {
      if (item.type === "message" && Array.isArray(item.content)) {
        for (const block of item.content) {
          if (block.type === "output_text" && block.text) {
            texts.push(block.text);
          }
        }
      }
    }
    if (texts.length > 0) return texts.join("\n");
  }

  return JSON.stringify(data);
}

/**
 * Call the CPN Agent via the Responses API (streaming).
 * Returns a ReadableStream that emits text chunks as they arrive.
 */
export async function callAgent(
  pricingContext: string,
  userDescription: string
): Promise<ReadableStream> {
  const agentName = getAgentName();
  const prompt = buildAgentPrompt(pricingContext, userDescription);

  const res = await agentFetch({
    input: [{ role: "user", content: prompt }],
    agent_reference: { name: agentName, type: "agent_reference" },
    stream: true,
    store: false,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Agent stream failed (${res.status}): ${errText.slice(0, 300)}`);
  }

  if (!res.body) {
    throw new Error("Agent stream response has no body");
  }

  const encoder = new TextEncoder();

  // Parse SSE stream from Azure into plain text chunks
  return new ReadableStream({
    async start(controller) {
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6).trim();
            if (payload === "[DONE]") continue;

            try {
              const event = JSON.parse(payload);
              if (
                event.type === "response.output_text.delta" &&
                event.delta
              ) {
                controller.enqueue(encoder.encode(event.delta));
              }
            } catch {
              // skip non-JSON lines
            }
          }
        }
      } catch (err) {
        controller.error(err);
      } finally {
        controller.close();
      }
    },
  });
}
