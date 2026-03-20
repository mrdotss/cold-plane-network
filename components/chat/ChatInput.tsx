"use client";

import React, { useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  FileAttachmentIcon,
  SentIcon,
  StopIcon,
} from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { FileAttachment } from "./FileAttachment";
import type { FileRef } from "@/lib/chat/types";

const ALLOWED_TYPES = [
  "application/json",
  "text/csv",
  "application/pdf",
  "image/jpeg",
  "image/png",
];
const ACCEPT_STRING = ALLOWED_TYPES.join(",");
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

interface ChatInputProps {
  onSend: (message: string, attachments: FileRef[]) => void;
  onStop?: () => void;
  onUploadFile: (file: File) => Promise<FileRef | null>;
  isStreaming?: boolean;
  disabled?: boolean;
}

export function ChatInput({
  onSend,
  onStop,
  onUploadFile,
  isStreaming,
  disabled,
}: ChatInputProps) {
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<FileRef[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canSend = (text.trim().length > 0 || attachments.length > 0) && !isStreaming && !disabled && !uploading;

  const resetTextarea = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, []);

  const handleSend = useCallback(() => {
    if (!canSend) return;
    onSend(text.trim(), attachments);
    setText("");
    setAttachments([]);
    resetTextarea();
  }, [canSend, text, attachments, onSend, resetTextarea]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    // Auto-resize
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, []);

  /** Validate and upload a single file. */
  const processFile = useCallback(
    async (file: File) => {
      if (!ALLOWED_TYPES.includes(file.type)) {
        return; // silently reject invalid types
      }
      if (file.size > MAX_SIZE) {
        return; // silently reject oversized files
      }
      setUploading(true);
      try {
        const ref = await onUploadFile(file);
        if (ref) {
          setAttachments((prev) => [...prev, ref]);
        }
      } finally {
        setUploading(false);
      }
    },
    [onUploadFile],
  );

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files) return;
      for (const file of Array.from(files)) {
        await processFile(file);
      }
      // Reset input so the same file can be re-selected
      e.target.value = "";
    },
    [processFile],
  );

  // Drag-and-drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const files = e.dataTransfer.files;
      for (const file of Array.from(files)) {
        await processFile(file);
      }
    },
    [processFile],
  );

  // Clipboard paste support
  const handlePaste = useCallback(
    async (e: React.ClipboardEvent) => {
      const items = e.clipboardData.items;
      for (const item of Array.from(items)) {
        if (item.kind === "file") {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            await processFile(file);
          }
        }
      }
    },
    [processFile],
  );

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  return (
    <div
      className={cn(
        "border-t p-3",
        isDragging && "ring-primary/50 bg-primary/5 ring-2",
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Attachment chips */}
      {attachments.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {attachments.map((file) => (
            <FileAttachment
              key={file.id}
              file={file}
              onRemove={() => removeAttachment(file.id)}
            />
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT_STRING}
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />

        {/* Attach button */}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={isStreaming || disabled}
          aria-label="Attach file"
        >
          <HugeiconsIcon icon={FileAttachmentIcon} strokeWidth={2} />
        </Button>

        {/* Auto-resizing textarea */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder="Ask about AWS pricing..."
          disabled={isStreaming || disabled}
          rows={1}
          className={cn(
            "border-input bg-transparent placeholder:text-muted-foreground flex-1 resize-none rounded-md border px-2.5 py-1.5 text-sm outline-none",
            "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-1",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
          style={{ maxHeight: 160 }}
        />

        {/* Send / Stop button */}
        {isStreaming ? (
          <Button
            variant="destructive"
            size="icon-sm"
            onClick={onStop}
            aria-label="Stop generating"
          >
            <HugeiconsIcon icon={StopIcon} strokeWidth={2} />
          </Button>
        ) : (
          <Button
            size="icon-sm"
            onClick={handleSend}
            disabled={!canSend}
            aria-label="Send message"
          >
            <HugeiconsIcon icon={SentIcon} strokeWidth={2} />
          </Button>
        )}
      </div>

      {uploading && (
        <p className="text-muted-foreground mt-1 text-xs">Uploading file...</p>
      )}
    </div>
  );
}
