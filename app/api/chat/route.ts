import { requireAuth, AuthError } from "@/lib/auth/middleware";
import { writeAuditEvent } from "@/lib/audit/writer";
import { createChat, getChat, saveMessage } from "@/lib/chat/queries";
import {
  createConversation,
  streamChatResponse,
} from "@/lib/chat/agent-client";
import { buildAttachmentContext } from "@/lib/chat/attachment-context";
import { getSystemPromptForMode } from "@/lib/chat/insights-prompt";
import type { ChatMode } from "@/lib/chat/insights-prompt";
import type { FileRef } from "@/lib/chat/types";

interface ChatRequestBody {
  chatId?: string;
  message: string;
  attachments?: FileRef[];
  pricingContext?: string;
  mode?: ChatMode;
}


/**
 * POST /api/chat
 *
 * If no chatId: create a new chat + Azure conversation, then stream.
 * If chatId: send message to existing chat, stream response.
 *
 * Streams SSE events: delta, done, error.
 * Saves user message + assistant response to DB after stream completes.
 */
export async function POST(request: Request) {
  let userId: string;
  try {
    const auth = await requireAuth();
    userId = auth.userId;
  } catch (err) {
    if (err instanceof AuthError) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = (await request.json()) as ChatRequestBody;
    const { message, attachments, pricingContext, mode } = body;
    let { chatId } = body;

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Message is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    let azureConversationId: string;

    // Create new chat if no chatId provided
    if (!chatId) {
      azureConversationId = await createConversation();
      const chat = await createChat(userId, azureConversationId);
      chatId = chat.id;

      // Audit: chat created (non-blocking)
      writeAuditEvent({
        userId,
        eventType: "CHAT_CREATED",
        metadata: { chatId },
      }).catch(() => {});
    } else {
      // Verify ownership
      const existing = await getChat(chatId, userId);
      if (!existing) {
        return new Response(JSON.stringify({ error: "Chat not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }
      azureConversationId = existing.chat.azureConversationId ?? "";
    }

    // Save user message to DB
    await saveMessage(chatId, "user", message, attachments);

    // Build system context from pricing data, attachments, and chat mode
    const contextParts: string[] = [];

    // Add mode-specific system prompt (e.g., insights mode)
    const modePrompt = mode ? getSystemPromptForMode(mode) : undefined;
    if (modePrompt) {
      contextParts.push(modePrompt);
    }

    if (pricingContext) {
      contextParts.push(pricingContext);
    }
    if (attachments && attachments.length > 0) {
      const attachmentContext = await buildAttachmentContext(attachments);
      if (attachmentContext) {
        contextParts.push(attachmentContext);
      }
    }
    const systemContext =
      contextParts.length > 0 ? contextParts.join("\n\n") : undefined;

    // Stream AI response
    const sseStream = await streamChatResponse(
      azureConversationId,
      message,
      systemContext,
    );

    // Wrap the stream to capture the full response for DB persistence
    const finalChatId = chatId;
    let fullResponse = "";
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const wrappedStream = new ReadableStream({
      async start(controller) {
        const reader = sseStream.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            // Parse SSE data to capture content
            const text = decoder.decode(value, { stream: true });
            const lines = text.split("\n");
            for (const line of lines) {
              if (line.startsWith("data: ")) {
                try {
                  const parsed = JSON.parse(line.slice(6));
                  if (parsed.type === "delta" && parsed.content) {
                    fullResponse += parsed.content;
                  }
                } catch {
                  // Not valid JSON — pass through
                }
              }
            }

            controller.enqueue(value);
          }
        } catch (err) {
          const errorMsg =
            err instanceof Error ? err.message : "Stream error";
          const errorData = JSON.stringify({ type: "error", message: errorMsg });
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
        } finally {
          // Save assistant response to DB after stream completes
          if (fullResponse.length > 0) {
            try {
              await saveMessage(finalChatId, "assistant", fullResponse);
            } catch {
              // DB save failure — non-blocking
            }
          }

          // Audit: message sent (non-blocking)
          writeAuditEvent({
            userId,
            eventType: "CHAT_MESSAGE_SENT",
            metadata: {
              chatId: finalChatId,
              hasAttachments: (attachments?.length ?? 0) > 0,
              attachmentTypes: attachments?.map((a) => a.type) ?? [],
            },
          }).catch(() => {});

          controller.close();
        }
      },
    });

    return new Response(wrappedStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Chat-Id": chatId,
      },
    });
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : "Chat request failed";

    if (errorMessage.includes("not set")) {
      return new Response(
        JSON.stringify({ error: "Agent service unavailable" }),
        { status: 503, headers: { "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ error: "Chat request failed", detail: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
