import "server-only";

import { DefaultAzureCredential, ClientSecretCredential } from "@azure/identity";

const AZURE_SCOPE = "https://ai.azure.com/.default";

/**
 * Cached token state to avoid re-acquiring on every request.
 */
let cachedToken: { token: string; expiresOn: number } | null = null;

/**
 * Resolve the Azure credential based on available env vars.
 */
function getCredential() {
  const tenantId = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;

  if (tenantId && clientId && clientSecret) {
    return new ClientSecretCredential(tenantId, clientId, clientSecret);
  }
  return new DefaultAzureCredential();
}

/**
 * Acquire a bearer token for Azure AI Foundry.
 * Caches the token and refreshes 5 minutes before expiry.
 */
export async function getAgentToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresOn - now > 5 * 60 * 1000) {
    return cachedToken.token;
  }

  const credential = getCredential();
  const tokenResponse = await credential.getToken(AZURE_SCOPE);

  if (!tokenResponse?.token) {
    throw new Error("Failed to acquire Azure AI token");
  }

  cachedToken = {
    token: tokenResponse.token,
    expiresOn: tokenResponse.expiresOnTimestamp,
  };
  return cachedToken.token;
}

/**
 * Get the Foundry endpoint and agent name from env vars.
 */
function getAgentConfig() {
  const endpoint = process.env.AZURE_EXISTING_AIPROJECT_ENDPOINT;
  const agentName = process.env.AZURE_EXISTING_AGENT_ID;

  if (!endpoint) {
    throw new Error("Agent service unavailable: AZURE_EXISTING_AIPROJECT_ENDPOINT not set");
  }
  if (!agentName) {
    throw new Error("Agent service unavailable: AZURE_EXISTING_AGENT_ID not set");
  }

  return { endpoint: endpoint.replace(/\/+$/, ""), agentName };
}

import type { AutofillServiceInput } from "./types";

/**
 * Build the prompt that combines pricing context with user description.
 * Exported for testing (Property 6).
 */
export function buildAgentPrompt(pricingContext: string, userDescription: string): string {
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
 * Uses the same approach as recommend — sends data as context, asks for structured response.
 * Does NOT instruct the agent to use MCP tools (avoids 429 rate limiting).
 * Exported for testing (Property 2).
 */
export function buildAutofillPrompt(
  services: AutofillServiceInput[],
  inputTier: string,
  missingTiers: string[]
): string {
  const serviceList = services
    .map(
      (s, i) =>
        `${i + 1}. Service: ${s.serviceName}\n   Description: ${s.description}\n   Region: ${s.region}\n   Configuration: ${s.configurationSummary}`
    )
    .join("\n");

  const missingDisplay = missingTiers.map((t) => TIER_DISPLAY[t] ?? t).join(", ");
  const inputDisplay = TIER_DISPLAY[inputTier] ?? inputTier;

  return [
    "## Pricing Tier Lookup Request",
    "",
    `The uploaded AWS Pricing Calculator estimate uses the **${inputDisplay}** pricing tier.`,
    `I need you to provide estimated pricing for the following missing tiers: **${missingDisplay}**.`,
    "",
    "### Services",
    "",
    serviceList,
    "",
    "### Instructions",
    "",
    `For each service listed above, provide the ${missingDisplay} pricing (upfront and monthly costs).`,
    "Use your knowledge of AWS pricing to provide the best estimates.",
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

/**
 * Azure AI Foundry Agents use the OpenAI Responses API.
 * The agent is referenced by name via the `agent` field in the request body.
 *
 * REST endpoint: POST {endpoint}/openai/v1/responses?api-version=2025-05-15-preview
 * Body: { input: [...], agent: { name: "agent-name", type: "agent_reference" } }
 */

interface ResponseOutput {
  type: string;
  content?: Array<{ type: string; text?: string }>;
  text?: string;
}

interface ResponsesApiResult {
  id: string;
  status: string;
  output: ResponseOutput[];
  output_text?: string;
}

/**
 * Extract text from a Responses API result.
 */
function extractResponseText(data: ResponsesApiResult): string {
  // output_text is a convenience field
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
 * Call the CPN Agent via the Responses API (non-streaming).
 * Returns the full agent response as a string.
 */
export async function callAgentSync(
  pricingContext: string,
  userDescription: string
): Promise<string> {
  const token = await getAgentToken();
  const { endpoint, agentName } = getAgentConfig();
  const prompt = buildAgentPrompt(pricingContext, userDescription);

  const url = `${endpoint}/openai/v1/responses?api-version=2025-05-15-preview`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: [{ role: "user", content: prompt }],
      agent: { name: agentName, type: "agent_reference" },
      store: false,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Agent request failed (${res.status}): ${text}`);
  }

  const data: ResponsesApiResult = await res.json();
  return extractResponseText(data);
}

/**
 * Call the CPN Agent via the Responses API (streaming).
 * Returns a ReadableStream that emits text chunks as they arrive.
 */
export async function callAgent(
  pricingContext: string,
  userDescription: string
): Promise<ReadableStream> {
  const token = await getAgentToken();
  const { endpoint, agentName } = getAgentConfig();
  const prompt = buildAgentPrompt(pricingContext, userDescription);

  const url = `${endpoint}/openai/v1/responses?api-version=2025-05-15-preview`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: [{ role: "user", content: prompt }],
      agent: { name: agentName, type: "agent_reference" },
      stream: true,
      store: false,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Agent request failed (${res.status}): ${text}`);
  }

  if (!res.body) {
    throw new Error("Agent returned no response body");
  }

  // Transform SSE stream into plain text chunks
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      const reader = res.body!.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          // Parse SSE events: lines starting with "data: "
          const lines = chunk.split("\n");
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6).trim();
            if (payload === "[DONE]") continue;

            try {
              const event = JSON.parse(payload);
              // Extract text delta from streaming events
              if (event.type === "response.output_text.delta" && event.delta) {
                controller.enqueue(encoder.encode(event.delta));
              }
            } catch {
              // Not valid JSON — skip
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
