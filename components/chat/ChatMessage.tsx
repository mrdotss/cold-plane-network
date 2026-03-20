"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { FileAttachment } from "./FileAttachment";
import type { ChatMessage as ChatMessageType } from "@/lib/chat/types";

interface ChatMessageProps {
  message: ChatMessageType;
  isStreaming?: boolean;
}

export function ChatMessage({ message, isStreaming }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex w-full gap-2", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-lg px-3 py-2",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground",
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap text-sm">{message.content}</p>
        ) : (
          <MarkdownRenderer content={message.content} />
        )}

        {/* Streaming cursor */}
        {isStreaming && !isUser && (
          <span className="bg-foreground/80 ml-0.5 inline-block h-4 w-1 animate-pulse rounded-sm" />
        )}

        {/* File attachment chips */}
        {message.attachments.length > 0 && (
          <div className={cn("mt-1.5 flex flex-wrap gap-1", isUser && "[&_*]:border-primary-foreground/30 [&_*]:text-primary-foreground")}>
            {message.attachments.map((file) => (
              <FileAttachment key={file.id} file={file} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
