import "server-only";

import { getBearerToken } from "@/lib/sizing/agent-client";

/**
 * Get the agent name from env vars.
 */
function getAgentName(): string {
  const agentName = process.env.AZURE_EXISTING_AGENT_ID;
  if (!agentName) {
    throw new Error(
      "Agent service unavailable: AZURE_EXISTING_AGENT_ID not set",
    );
  }
  return agentName;
}

/**
 * Get the base URL for Azure AI Foundry API.
 */
function getBaseURL(): string {
  const endpoint = process.env.AZURE_EXISTING_AIPROJECT_ENDPOINT;
  if (!endpoint) {
    throw new Error(
      "Agent service unavailable: AZURE_EXISTING_AIPROJECT_ENDPOINT not set",
    );
  }
  return `${endpoint}/openai/v1`;
}

/**
 * Create a new Azure AI Foundry conversation for multi-turn chat.
 * Returns the conversation ID to be stored in the chat record.
 */
export async function createConversation(): Promise<string> {
  const baseURL = getBaseURL();
  const token = await getBearerToken();

  const res = await fetch(`${baseURL}/conversations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({}),
  });

  if (!res.ok) {
    // Fallback: generate a local conversation ID
    const { randomUUID } = await import("crypto");
    return `local-${randomUUID()}`;
  }

  const data = await res.json();
  return data.id;
}

/**
 * Stream a chat response from the Azure AI Foundry agent.
 * Uses direct fetch() to bypass OpenAI SDK body transformation issues.
 *
 * Returns a ReadableStream of SSE-formatted events:
 *   - { type: "delta", content: "..." }
 *   - { type: "done" }
 *   - { type: "error", message: "..." }
 */
export async function streamChatResponse(
  conversationId: string,
  message: string,
  systemContext?: string,
): Promise<ReadableStream> {
  const agentName = getAgentName();
  const baseURL = getBaseURL();
  const token = await getBearerToken();
  const encoder = new TextEncoder();

  const input: Array<{ type: string; role: string; content: string }> = [];
  if (systemContext) {
    input.push({ type: "message", role: "developer", content: systemContext });
  }
  input.push({ type: "message", role: "user", content: message });

  // Build the request body — direct fetch, no SDK transformation
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const requestBody: Record<string, any> = {
    input,
    agent_reference: { name: agentName, type: "agent_reference" },
    stream: true,
  };

  // Attach conversation reference if not a local fallback ID
  if (!conversationId.startsWith("local-")) {
    requestBody.conversation = conversationId;
  }

  return new ReadableStream({
    async start(controller) {
      try {
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
          const errorData = JSON.stringify({
            type: "error",
            message: `${res.status} ${errText.slice(0, 300)}`,
          });
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
          return;
        }

        if (!res.body) {
          const errorData = JSON.stringify({
            type: "error",
            message: "No response body from agent",
          });
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
          return;
        }

        // Parse Azure SSE stream → re-emit as our SSE format
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

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
                const sseData = JSON.stringify({
                  type: "delta",
                  content: event.delta,
                });
                controller.enqueue(encoder.encode(`data: ${sseData}\n\n`));
              }
            } catch {
              // skip non-JSON lines
            }
          }
        }

        const doneData = JSON.stringify({ type: "done" });
        controller.enqueue(encoder.encode(`data: ${doneData}\n\n`));
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Agent request failed";
        const errorData = JSON.stringify({
          type: "error",
          message: errorMessage,
        });
        controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
      } finally {
        controller.close();
      }
    },
  });
}
