"use client";

import React, { useEffect, useRef } from "react";
import { ChatMessage } from "./ChatMessage";
import type { ChatMessage as ChatMessageType } from "@/lib/chat/types";

interface ChatMessagesProps {
  messages: ChatMessageType[];
  /** ID of the message currently being streamed (if any). */
  streamingMessageId?: string;
}

export function ChatMessages({ messages, streamingMessageId }: ChatMessagesProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change or during streaming
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingMessageId]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <p className="text-muted-foreground text-sm">
          Start a conversation by typing a message below.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto p-4"
      role="log"
      aria-label="Chat messages"
    >
      <div className="space-y-3" aria-live="polite" aria-relevant="additions">
        {messages.map((msg) => (
          <ChatMessage
            key={msg.id}
            message={msg}
            isStreaming={msg.id === streamingMessageId}
          />
        ))}
      </div>
      <div ref={bottomRef} />
    </div>
  );
}
