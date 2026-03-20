"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { FileAttachment } from "./FileAttachment";
import { formatRelativeDate } from "@/lib/chat/format-date";
import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Copy01Icon,
  Tick02Icon,
  RepeatIcon,
} from "@hugeicons/core-free-icons";
import type { ChatMessage as ChatMessageType } from "@/lib/chat/types";

interface ChatMessageProps {
  message: ChatMessageType;
  isStreaming?: boolean;
  onRemoveAttachment?: (messageId: string, attachmentId: string) => void;
  onRetry?: (messageId: string) => void;
}

function CopyButton({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Button
      variant="ghost"
      size="icon-xs"
      onClick={handleCopy}
      aria-label="Copy message"
      className="text-muted-foreground hover:text-foreground"
    >
      <HugeiconsIcon
        icon={copied ? Tick02Icon : Copy01Icon}
        strokeWidth={2}
        className="size-3.5"
      />
    </Button>
  );
}

export function ChatMessage({
  message,
  isStreaming,
  onRemoveAttachment,
  onRetry,
}: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "group flex w-full gap-2",
        isUser ? "justify-end" : "justify-start",
      )}
    >
      <div className="flex max-w-[85%] flex-col">
        {/* Message bubble */}
        <div
          className={cn(
            "rounded-lg px-3 py-2",
            isUser
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-foreground",
          )}
        >
          {/* Fix 5: Thinking animation when streaming with no content yet */}
          {!isUser && isStreaming && message.content.length === 0 ? (
            <div className="flex items-center gap-1.5 py-1">
              <span className="text-muted-foreground text-sm">Thinking</span>
              <span className="flex gap-0.5">
                <span className="bg-muted-foreground/60 size-1.5 animate-bounce rounded-full [animation-delay:0ms]" />
                <span className="bg-muted-foreground/60 size-1.5 animate-bounce rounded-full [animation-delay:150ms]" />
                <span className="bg-muted-foreground/60 size-1.5 animate-bounce rounded-full [animation-delay:300ms]" />
              </span>
            </div>
          ) : isUser ? (
            <p className="whitespace-pre-wrap text-sm">{message.content}</p>
          ) : (
            <MarkdownRenderer content={message.content} />
          )}

          {/* Streaming cursor — only when content has started arriving */}
          {isStreaming && !isUser && message.content.length > 0 && (
            <span className="bg-foreground/80 ml-0.5 inline-block h-4 w-1 animate-pulse rounded-sm" />
          )}

          {/* Fix 3: File attachment chips with remove support for user messages */}
          {message.attachments.length > 0 && (
            <div
              className={cn(
                "mt-1.5 flex flex-wrap gap-1",
                isUser &&
                  "[&_*]:border-primary-foreground/30 [&_*]:text-primary-foreground",
              )}
            >
              {message.attachments.map((file) => (
                <FileAttachment
                  key={file.id}
                  file={file}
                  onRemove={
                    isUser && onRemoveAttachment
                      ? () => onRemoveAttachment(message.id, file.id)
                      : undefined
                  }
                />
              ))}
            </div>
          )}
        </div>

        {/* Fix 7: Action buttons for assistant messages */}
        {!isUser && !isStreaming && message.content.length > 0 && (
          <div className="mt-1 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            <CopyButton content={message.content} />
            {onRetry && (
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => onRetry(message.id)}
                aria-label="Retry response"
                className="text-muted-foreground hover:text-foreground"
              >
                <HugeiconsIcon
                  icon={RepeatIcon}
                  strokeWidth={2}
                  className="size-3.5"
                />
              </Button>
            )}
          </div>
        )}

        {/* Fix 6: Hover timestamp */}
        <span
          className={cn(
            "text-muted-foreground mt-0.5 text-[10px] opacity-0 transition-opacity group-hover:opacity-100",
            isUser ? "text-right" : "text-left",
          )}
        >
          {formatRelativeDate(message.createdAt)}
        </span>
      </div>
    </div>
  );
}
