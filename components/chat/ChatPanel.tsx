"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { ChatMessages } from "./ChatMessages";
import { ChatInput } from "./ChatInput";
import { ChatSidebar } from "./ChatSidebar";
import { ChatModeSelector } from "./ChatModeSelector";
import { HugeiconsIcon } from "@hugeicons/react";
import { InformationCircleIcon, SidebarLeftIcon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import type {
  ChatConversation,
  ChatMessage,
  FileRef,
  SSEEvent,
} from "@/lib/chat/types";
import type { PricingData } from "@/lib/sizing/types";
import type { ChatMode } from "@/lib/chat/insights-prompt";

interface ChatPanelProps {
  pricingData?: PricingData | null;
  fileName?: string;
}

/** Build a pricing context summary for the chat system prompt. */
export function buildPricingContext(
  data: PricingData,
  fileName: string,
): string {
  const tierNames = data.tiers.map((t) => t.tierName).join(", ");
  const regions = data.regions.join(", ");
  return [
    "## Uploaded AWS Pricing Data",
    `File: ${fileName}`,
    `Services: ${data.serviceCount}`,
    `Regions: ${regions}`,
    `Available tiers: ${tierNames}`,
    `Total monthly (primary tier): ${data.totalMonthly.toFixed(2)}`,
    `Currency: ${data.currency}`,
    "",
    "The user has uploaded this pricing data. Use it as context when answering questions about their AWS sizing and costs.",
  ].join("\n");
}

export function ChatPanel({ pricingData, fileName }: ChatPanelProps) {
  const [chats, setChats] = useState<ChatConversation[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | undefined>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | undefined>();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chatMode, setChatMode] = useState<ChatMode>("sizing");
  const abortRef = useRef<AbortController | null>(null);

  // Load chat list on mount
  useEffect(() => {
    loadChats();
  }, []);

  // Show pricing data notification
  const pricingNotification =
    pricingData && fileName
      ? `File loaded: ${fileName} (${pricingData.serviceCount} services)`
      : null;

  async function loadChats() {
    try {
      const res = await fetch("/api/chat/list");
      if (!res.ok) return;
      const data = await res.json();
      setChats(data.chats ?? []);
    } catch {
      // Non-blocking — sidebar just stays empty
    }
  }

  async function loadChatMessages(chatId: string) {
    try {
      const res = await fetch(`/api/chat/${chatId}`);
      if (!res.ok) return;
      const data = await res.json();
      setMessages(data.messages ?? []);
    } catch {
      setMessages([]);
    }
  }

  const handleSelectChat = useCallback(async (chatId: string) => {
    setActiveChatId(chatId);
    setError(null);
    await loadChatMessages(chatId);
  }, []);

  const handleNewChat = useCallback(() => {
    setActiveChatId(undefined);
    setMessages([]);
    setError(null);
  }, []);

  const handleModeChange = useCallback((newMode: ChatMode) => {
    setChatMode(newMode);
    // Start a new conversation when switching modes
    setActiveChatId(undefined);
    setMessages([]);
    setError(null);
  }, []);

  const handleDeleteChat = useCallback(
    async (chatId: string) => {
      try {
        await fetch(`/api/chat/${chatId}`, { method: "DELETE" });
        setChats((prev) => prev.filter((c) => c.id !== chatId));
        if (activeChatId === chatId) {
          setActiveChatId(undefined);
          setMessages([]);
        }
      } catch {
        // Silently fail — user can retry
      }
    },
    [activeChatId],
  );

  // Fix 4: Rename conversation
  const handleRenameChat = useCallback(
    async (chatId: string, newTitle: string) => {
      try {
        const res = await fetch(`/api/chat/${chatId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: newTitle }),
        });
        if (res.ok) {
          setChats((prev) =>
            prev.map((c) =>
              c.id === chatId ? { ...c, title: newTitle } : c,
            ),
          );
        }
      } catch {
        // Silently fail
      }
    },
    [],
  );

  // Fix 3: Remove attachment from a user message
  const handleRemoveAttachment = useCallback(
    (messageId: string, attachmentId: string) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? {
                ...m,
                attachments: m.attachments.filter((a) => a.id !== attachmentId),
              }
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
      const res = await fetch("/api/files/upload", {
        method: "POST",
        body: formData,
      });
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

  /**
   * Core streaming logic — creates an assistant placeholder and streams the response.
   * Extracted from handleSend so it can be reused by handleRetry.
   */
  const streamResponse = useCallback(
    async (
      message: string,
      attachments: FileRef[],
      chatId: string | undefined,
    ) => {
      // Placeholder for assistant response
      const assistantMsgId = crypto.randomUUID();
      const assistantMsg: ChatMessage = {
        id: assistantMsgId,
        chatId: chatId ?? "",
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
        // Build pricing context if available
        const pricingContext =
          pricingData && fileName
            ? buildPricingContext(pricingData, fileName)
            : undefined;

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chatId,
            message,
            attachments,
            pricingContext,
            mode: chatMode,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: "Request failed" }));
          throw new Error(body.error || `Chat request failed (${res.status})`);
        }

        // Read the new chatId from response header if this was a new chat
        const newChatId = res.headers.get("X-Chat-Id");
        if (newChatId && !chatId) {
          setActiveChatId(newChatId);
          setMessages((prev) =>
            prev.map((m) =>
              m.chatId === "" ? { ...m, chatId: newChatId } : m,
            ),
          );
        }

        // Stream SSE response
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

        // Refresh chat list to pick up new/updated conversations
        await loadChats();
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          const msg = err instanceof Error ? err.message : "Failed to send message";
          setError(msg);
          // Remove the empty assistant placeholder on error
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
    [pricingData, fileName],
  );

  const handleSend = useCallback(
    async (message: string, attachments: FileRef[]) => {
      setError(null);

      // Optimistic user message
      const userMsgId = crypto.randomUUID();
      const userMsg: ChatMessage = {
        id: userMsgId,
        chatId: activeChatId ?? "",
        role: "user",
        content: message,
        attachments,
        createdAt: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);

      await streamResponse(message, attachments, activeChatId);
    },
    [activeChatId, streamResponse],
  );

  // Fix 7: Retry — remove assistant message and re-stream
  const handleRetry = useCallback(
    async (assistantMessageId: string) => {
      if (isStreaming) return;

      // Find the assistant message and the preceding user message
      const msgIndex = messages.findIndex((m) => m.id === assistantMessageId);
      if (msgIndex < 0) return;

      const assistantMsg = messages[msgIndex];
      if (assistantMsg.role !== "assistant") return;

      const userMsg = messages
        .slice(0, msgIndex)
        .reverse()
        .find((m) => m.role === "user");
      if (!userMsg) return;

      // Remove the assistant message from local state
      setMessages((prev) => prev.filter((m) => m.id !== assistantMessageId));
      setError(null);

      // Re-stream the response
      await streamResponse(
        userMsg.content,
        userMsg.attachments,
        activeChatId,
      );
    },
    [messages, activeChatId, isStreaming, streamResponse],
  );

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar */}
      {sidebarOpen && (
        <div className="w-52 shrink-0">
          <ChatSidebar
            chats={chats}
            activeChatId={activeChatId}
            onSelect={handleSelectChat}
            onDelete={handleDeleteChat}
            onNewChat={handleNewChat}
            onRename={handleRenameChat}
          />
        </div>
      )}

      {/* Main chat area */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* Header */}
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
          >
            <HugeiconsIcon icon={SidebarLeftIcon} strokeWidth={2} />
          </Button>
          <ChatModeSelector mode={chatMode} onModeChange={handleModeChange} />
          <span className="ml-auto text-sm font-medium">
            {activeChatId
              ? chats.find((c) => c.id === activeChatId)?.title ?? "Chat"
              : "New Chat"}
          </span>
        </div>

        {/* Pricing data notification */}
        {pricingNotification && (
          <div className="flex items-center gap-2 border-b bg-blue-50 px-3 py-1.5 dark:bg-blue-950">
            <HugeiconsIcon
              icon={InformationCircleIcon}
              strokeWidth={2}
              className="size-3.5 text-blue-600 dark:text-blue-400"
            />
            <span className="text-xs text-blue-700 dark:text-blue-300">
              {pricingNotification}
            </span>
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="border-b bg-red-50 px-3 py-1.5 dark:bg-red-950">
            <p className="text-xs text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        {/* Messages */}
        <ChatMessages
          messages={messages}
          streamingMessageId={streamingMessageId}
          onRemoveAttachment={handleRemoveAttachment}
          onRetry={handleRetry}
        />

        {/* Input */}
        <ChatInput
          onSend={handleSend}
          onStop={handleStop}
          onUploadFile={handleUploadFile}
          isStreaming={isStreaming}
        />
      </div>
    </div>
  );
}
