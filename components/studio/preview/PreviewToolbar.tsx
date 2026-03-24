"use client";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  CheckmarkBadge01Icon,
  Settings01Icon,
  Share01Icon,
  Download01Icon,
  LinkCircleIcon,
  UnlinkIcon,
} from "@hugeicons/core-free-icons";

interface PreviewToolbarProps {
  isEmpty: boolean;
  hasErrors: boolean;
  hasArtifacts: boolean;
  loadingAction: "validate" | "generate" | "share" | "download" | null;
  showInferredEdges: boolean;
  inferredEdgeCount: number;
  onToggleInferredEdges: () => void;
  onValidate: () => void;
  onGenerate: () => void;
  onShare: () => void;
  onDownload: () => void;
}

interface ToolbarButtonProps {
  label: string;
  icon: Parameters<typeof HugeiconsIcon>[0]["icon"];
  variant: "default" | "outline";
  disabled: boolean;
  loading: boolean;
  loadingText: string;
  tooltip: string | null;
  onClick: () => void;
}

function ToolbarButton({
  label,
  icon,
  variant,
  disabled,
  loading,
  loadingText,
  tooltip,
  onClick,
}: ToolbarButtonProps) {
  const button = (
    <Button
      variant={variant}
      size="sm"
      disabled={disabled || loading}
      onClick={onClick}
      aria-label={label}
    >
      <HugeiconsIcon icon={icon} size={14} data-icon="inline-start" />
      {loading ? loadingText : label}
    </Button>
  );

  if (tooltip && disabled) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0}>{button}</span>
        </TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    );
  }

  return button;
}

export function PreviewToolbar({
  isEmpty,
  hasErrors,
  hasArtifacts,
  loadingAction,
  showInferredEdges,
  inferredEdgeCount,
  onToggleInferredEdges,
  onValidate,
  onGenerate,
  onShare,
  onDownload,
}: PreviewToolbarProps) {
  return (
    <TooltipProvider>
      <div className="flex items-center gap-1.5">
        <ToolbarButton
          label="Validate"
          icon={CheckmarkBadge01Icon}
          variant="default"
          disabled={isEmpty}
          loading={loadingAction === "validate"}
          loadingText="Validating…"
          tooltip={isEmpty ? "Enter a spec to validate" : null}
          onClick={onValidate}
        />
        <ToolbarButton
          label="Generate"
          icon={Settings01Icon}
          variant="default"
          disabled={isEmpty || hasErrors}
          loading={loadingAction === "generate"}
          loadingText="Generating…"
          tooltip={
            isEmpty
              ? "Enter a spec first"
              : hasErrors
                ? "Fix validation errors before generating"
                : null
          }
          onClick={onGenerate}
        />
        <ToolbarButton
          label="Share"
          icon={Share01Icon}
          variant="outline"
          disabled={isEmpty}
          loading={loadingAction === "share"}
          loadingText="Copied!"
          tooltip={isEmpty ? "Enter a spec to share" : null}
          onClick={onShare}
        />
        <ToolbarButton
          label="Download"
          icon={Download01Icon}
          variant="outline"
          disabled={!hasArtifacts}
          loading={loadingAction === "download"}
          loadingText="Packaging…"
          tooltip={!hasArtifacts ? "Generate artifacts first" : null}
          onClick={onDownload}
        />

        <div className="mx-1 h-4 w-px bg-border" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={showInferredEdges ? "secondary" : "ghost"}
              size="sm"
              onClick={onToggleInferredEdges}
              aria-label={showInferredEdges ? "Hide inferred edges" : "Show inferred edges"}
              className="gap-1.5"
            >
              <HugeiconsIcon
                icon={showInferredEdges ? LinkCircleIcon : UnlinkIcon}
                size={14}
                data-icon="inline-start"
              />
              Inferred
              {inferredEdgeCount > 0 && (
                <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                  {inferredEdgeCount}
                </span>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {showInferredEdges
              ? `Hide ${inferredEdgeCount} inferred connection${inferredEdgeCount !== 1 ? "s" : ""}`
              : `Show ${inferredEdgeCount} inferred connection${inferredEdgeCount !== 1 ? "s" : ""}`}
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
