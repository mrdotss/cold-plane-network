"use client";

import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Alert02Icon,
  AiInnovation01Icon,
  Search01Icon,
  Add01Icon,
} from "@hugeicons/core-free-icons";

// ─── Error state ─────────────────────────────────────────────────────────────

interface CfmErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export function CfmErrorState({
  title = "Something went wrong",
  message,
  onRetry,
  retryLabel = "Try again",
}: CfmErrorStateProps) {
  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <div className="flex flex-col items-center gap-3 text-center max-w-sm">
        <HugeiconsIcon
          icon={Alert02Icon}
          strokeWidth={1.5}
          className="size-10 text-destructive"
        />
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-medium">{title}</h3>
          <p className="text-xs text-muted-foreground">{message}</p>
        </div>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            {retryLabel}
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Empty states ────────────────────────────────────────────────────────────

interface CfmEmptyStateProps {
  icon?: typeof AiInnovation01Icon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function CfmEmptyState({
  icon = Search01Icon,
  title,
  description,
  actionLabel,
  onAction,
}: CfmEmptyStateProps) {
  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <div className="flex flex-col items-center gap-3 text-center max-w-sm">
        <HugeiconsIcon
          icon={icon}
          strokeWidth={1.5}
          className="size-10 text-muted-foreground"
        />
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-medium">{title}</h3>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        {actionLabel && onAction && (
          <Button size="sm" onClick={onAction}>
            <HugeiconsIcon icon={Add01Icon} data-icon="inline-start" strokeWidth={2} />
            {actionLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
