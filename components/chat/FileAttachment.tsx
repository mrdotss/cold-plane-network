"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  File01Icon,
  Cancel01Icon,
  Image01Icon,
  FileAttachmentIcon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import { cn } from "@/lib/utils";
import type { FileRef } from "@/lib/chat/types";

const MIME_ICONS: Record<string, IconSvgElement> = {
  "application/json": FileAttachmentIcon,
  "text/csv": FileAttachmentIcon,
  "application/pdf": File01Icon,
  "image/jpeg": Image01Icon,
  "image/png": Image01Icon,
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function mimeLabel(type: string): string {
  const map: Record<string, string> = {
    "application/json": "JSON",
    "text/csv": "CSV",
    "application/pdf": "PDF",
    "image/jpeg": "JPEG",
    "image/png": "PNG",
  };
  return map[type] ?? type;
}

interface FileAttachmentProps {
  file: FileRef;
  onRemove?: () => void;
  className?: string;
}

export function FileAttachment({ file, onRemove, className }: FileAttachmentProps) {
  const icon = MIME_ICONS[file.type] ?? File01Icon;
  const sizeStr = formatSize(file.size);
  const typeLabel = mimeLabel(file.type);

  return (
    <Badge
      variant="outline"
      className={cn("h-auto gap-1.5 py-1 pl-1.5 pr-1", className)}
      aria-label={`${file.name}, ${typeLabel}, ${sizeStr}`}
    >
      <HugeiconsIcon icon={icon} strokeWidth={2} className="size-3.5 shrink-0" />
      <span className="max-w-[120px] truncate text-xs">{file.name}</span>
      <span className="text-muted-foreground text-[10px]">{sizeStr}</span>
      {onRemove && (
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onRemove}
          aria-label={`Remove ${file.name}`}
          className="ml-0.5 size-4"
        >
          <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} className="size-2.5" />
        </Button>
      )}
    </Badge>
  );
}
