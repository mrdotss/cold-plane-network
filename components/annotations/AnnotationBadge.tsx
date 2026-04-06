"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { Note01Icon } from "@hugeicons/core-free-icons";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface AnnotationBadgeProps {
  count: number;
  latestContent?: string;
}

export function AnnotationBadge({ count, latestContent }: AnnotationBadgeProps) {
  if (count === 0) return null;

  const preview =
    latestContent && latestContent.length > 80
      ? `${latestContent.slice(0, 80)}…`
      : latestContent;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className="inline-flex items-center gap-0.5 rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground cursor-default"
          aria-label={`${count} note${count !== 1 ? "s" : ""}`}
        >
          <HugeiconsIcon icon={Note01Icon} strokeWidth={2} className="size-3" />
          {count}
        </span>
      </TooltipTrigger>
      {preview && (
        <TooltipContent side="top" className="max-w-xs">
          <p className="text-xs">{preview}</p>
        </TooltipContent>
      )}
    </Tooltip>
  );
}
