"use client";

import { useState, useCallback, useRef } from "react";
import { ChatMessages } from "@/components/chat/ChatMessages";
import { ChatInput } from "@/components/chat/ChatInput";
import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import { Comment01Icon } from "@hugeicons/core-free-icons";
import type { ChatMessage, FileRef, SSEEvent } from "@/lib/chat/types";
import type { CfmRecommendation } from "@/lib/cfm/types";

interface CfmChatPanelProps {
  accountName: string;
  awsAccountId: string;
  service: string;
  regions: string[];
  scanId: string;
  azureConversationId: string | null;
  recommendations: CfmRecommendation[];
}

/**
 * Build the CFM deep dive system prompt client-side.
 * Mirrors buildDeepDiveChatPrompt from scanner.ts but runs in the browser.
 */
function buildCfmContext(props: CfmChatPanelProps): string {
  const recs = props.recommendations.map((r) => ({
    resourceId: r.resourceId,
    resourceName: r.resourceName,
    priority: r.priority,
    recommendation: r.recommendation,
    currentCost: r.currentCost,
    estimatedSavings: r.estimatedSavings,
    effort: r.effort,
    metadata: r.metadata,
  }));

  return [
    `You are a cost optimization specialist for AWS ${props.service}. You are continuing a conversation about a customer's AWS account analysis.`,
    "",
    "## Context",
    `- AWS Account: ${props.accountName} (${props.awsAccountId})`,
    `- Service: ${props.service}`,
    `- Regions: ${props.regions.join(", ")}`,
    "",
    "## Current Findings",
    JSON.stringify(recs, null, 2),
    "",
    "## Instructions",
    "Help the user understand the recommendations, answer questions about specific resources, suggest implementation steps, and provide additional analysis if requested. You have access to the customer's AWS account via CFM MCP tools — use them to look up additional details when the user asks.",
  ].join("\n");
}

export function CfmChatPanel(props: CfmChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [chatId, setChatId] = useState<string | undefined>();
  const abortRef = useRef<AbortController | null>(null);

  const cfmContext = buildCfmContext(props);

  const handleRemoveAttachment = useCallback(
    (messageId: string, attachmentId: string) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, attachments: m.attachments.filter((a) => a.id !== attachmentId) }
            : m,
        ),
      );
    },
    [],
  );

  const handleUploadFile = useCallback(async (file: File): Promise<FileRef | null> => {
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/files/upload", { method: "POST", body: formData });
      if (!res.ok) return null;
      const json = await res.json();
      return (json.data ?? json) as FileRef;
    } catch {
      return null;
    }
  }, []);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
    setStreamingMessageId(undefined);
  }, []);

  const streamResponse = useCallback(
    async (message: string, attachments: FileRef[], currentChatId: string | undefined) => {
      const assistantMsgId = crypto.randomUUID();
      const assistantMsg: ChatMessage = {
        id: assistantMsgId,
        chatId: currentChatId ?? "",
        role: "assistant",
        content: "",
        attachments: [],
        createdAt: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setIsStreaming(true);
      setStreamingMessageId(assistantMsgId);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chatId: currentChatId,
            message,
            attachments,
            pricingContext: cfmContext,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: "Request failed" }));
          throw new Error(body.error || `Chat request failed (${res.status})`);
        }

        const newChatId = res.headers.get("X-Chat-Id");
        if (newChatId && !currentChatId) {
          setChatId(newChatId);
          setMessages((prev) =>
            prev.map((m) => (m.chatId === "" ? { ...m, chatId: newChatId } : m)),
          );
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response stream");

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
            const jsonStr = line.slice(6).trim();
            if (!jsonStr || jsonStr === "[DONE]") continue;

            try {
              const event: SSEEvent = JSON.parse(jsonStr);
              if (event.type === "delta") {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsgId
                      ? { ...m, content: m.content + event.content }
                      : m,
                  ),
                );
              } else if (event.type === "error") {
                setError(event.message);
              }
            } catch {
              // Skip malformed SSE lines
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          const msg = err instanceof Error ? err.message : "Failed to send message";
          setError(msg);
          setMessages((prev) =>
            prev.filter((m) => m.id !== assistantMsgId || m.content.length > 0),
          );
        }
      } finally {
        setIsStreaming(false);
        setStreamingMessageId(undefined);
        abortRef.current = null;
      }
    },
    [cfmContext],
  );

  const handleSend = useCallback(
    async (message: string, attachments: FileRef[]) => {
      setError(null);

      const userMsgId = crypto.randomUUID();
      const userMsg: ChatMessage = {
        id: userMsgId,
        chatId: chatId ?? "",
        role: "user",
        content: message,
        attachments,
        createdAt: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);

      await streamResponse(message, attachments, chatId);
    },
    [chatId, streamResponse],
  );

  const handleRetry = useCallback(
    async (assistantMessageId: string) => {
      if (isStreaming) return;

      const msgIndex = messages.findIndex((m) => m.id === assistantMessageId);
      if (msgIndex < 0) return;

      const assistantMsg = messages[msgIndex];
      if (assistantMsg.role !== "assistant") return;

      const userMsg = messages.slice(0, msgIndex).reverse().find((m) => m.role === "user");
      if (!userMsg) return;

      setMessages((prev) => prev.filter((m) => m.id !== assistantMessageId));
      setError(null);

      await streamResponse(userMsg.content, userMsg.attachments, chatId);
    },
    [messages, chatId, isStreaming, streamResponse],
  );

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <HugeiconsIcon icon={Comment01Icon} strokeWidth={2} className="size-4 text-muted-foreground" />
        <span className="text-sm font-medium">{props.service} Assistant</span>
      </div>

      {/* Context banner */}
      <div className="border-b bg-blue-50 px-3 py-1.5 dark:bg-blue-950">
        <span className="text-xs text-blue-700 dark:text-blue-300">
          Scoped to {props.service} · {props.recommendations.length} recommendation{props.recommendations.length !== 1 ? "s" : ""} loaded
        </span>
      </div>

      {/* Error banner */}
      {error && (
        <div className="border-b bg-red-50 px-3 py-1.5 dark:bg-red-950">
          <p className="text-xs text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* Empty state */}
      {messages.length === 0 && !isStreaming && (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center">
          <HugeiconsIcon icon={Comment01Icon} strokeWidth={1.5} className="size-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            Ask questions about {props.service} recommendations
          </p>
          <div className="flex flex-wrap justify-center gap-1.5 pt-1">
            {[
              `Why is this ${props.service} resource flagged?`,
              "How do I implement this recommendation?",
              "Compare Savings Plans vs Reserved Instances",
            ].map((suggestion) => (
              <Button
                key={suggestion}
                variant="outline"
                size="sm"
                className="h-auto px-2 py-1 text-xs"
                onClick={() => handleSend(suggestion, [])}
              >
                {suggestion}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      {messages.length > 0 && (
        <ChatMessages
          messages={messages}
          streamingMessageId={streamingMessageId}
          onRemoveAttachment={handleRemoveAttachment}
          onRetry={handleRetry}
        />
      )}

      {/* Input */}
      <ChatInput
        onSend={handleSend}
        onStop={handleStop}
        onUploadFile={handleUploadFile}
        isStreaming={isStreaming}
      />
    </div>
  );
}
