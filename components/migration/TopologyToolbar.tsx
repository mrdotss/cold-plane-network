"use client";

import React, { memo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Search01Icon,
  Cancel01Icon,
  ArrowShrinkIcon,
  FilterIcon,
} from "@hugeicons/core-free-icons";
import type { RelationType, ConfidenceLevel } from "@/lib/migration/relationship-engine";

/* ── Constants ── */

const RELATION_TYPE_LABELS: Record<RelationType, { label: string; color: string }> = {
  network:    { label: "Network",    color: "#3b82f6" },
  storage:    { label: "Storage",    color: "#22c55e" },
  security:   { label: "Security",   color: "#f97316" },
  contains:   { label: "Contains",   color: "#94a3b8" },
  gateway:    { label: "Gateway",    color: "#a855f7" },
  monitoring: { label: "Monitoring", color: "#06b6d4" },
};

const CONFIDENCE_COLORS: Record<string, string> = {
  Definite: "#3b82f6",
  High:     "#22c55e",
  Medium:   "#eab308",
  Low:      "#f97316",
};

const ALL_RELATION_TYPES: RelationType[] = ["network", "storage", "security", "contains", "gateway", "monitoring"];
const ALL_CONFIDENCE_LEVELS: ConfidenceLevel[] = ["Definite", "High", "Medium", "Low"];

/* ── Sub-components ── */

type ViewMode = "dual" | "azure-only" | "aws-only";

function FilterChip({
  label,
  color,
  active,
  onClick,
}: {
  label: string;
  color?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`
        inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium
        border transition-all duration-100
        ${active
          ? "bg-foreground/5 border-foreground/20 text-foreground"
          : "bg-transparent border-transparent text-muted-foreground/50 line-through"
        }
      `}
    >
      {color && (
        <span
          className="h-2 w-2 rounded-full shrink-0"
          style={{ backgroundColor: color, opacity: active ? 1 : 0.3 }}
        />
      )}
      {label}
    </button>
  );
}

function ViewModeToggle({
  mode,
  onChange,
}: {
  mode: ViewMode;
  onChange: (m: ViewMode) => void;
}) {
  const options: Array<{ value: ViewMode; label: string }> = [
    { value: "dual", label: "Dual" },
    { value: "azure-only", label: "Azure" },
    { value: "aws-only", label: "AWS" },
  ];
  return (
    <div className="flex rounded-lg border bg-muted/30 p-0.5" role="radiogroup" aria-label="View mode">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={mode === o.value}
          onClick={() => onChange(o.value)}
          className={`
            px-2.5 py-1 text-[10px] font-medium rounded-md transition-all
            ${mode === o.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
            }
          `}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function ResourceGroupFilter({
  resourceGroups,
  activeRGs,
  onToggle,
}: {
  resourceGroups: string[];
  activeRGs: Set<string>;
  onToggle: (rg: string) => void;
}) {
  if (resourceGroups.length <= 1) return null;

  const allActive = activeRGs.size === resourceGroups.length;
  const noneActive = activeRGs.size === 0;
  const label = allActive
    ? "All RGs"
    : noneActive
      ? "No RGs"
      : `${activeRGs.size}/${resourceGroups.length} RGs`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1.5 px-2.5">
          <HugeiconsIcon icon={FilterIcon} size={12} />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1">
          Resource Groups
        </div>
        <div className="max-h-48 overflow-y-auto">
          {resourceGroups.map((rg) => (
            <label
              key={rg}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-muted/50 cursor-pointer"
            >
              <Checkbox
                checked={activeRGs.has(rg)}
                onCheckedChange={() => onToggle(rg)}
              />
              <span className="truncate">{rg}</span>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function RelationTypeFilter({
  activeRelTypes,
  onToggle,
}: {
  activeRelTypes: Set<RelationType>;
  onToggle: (t: RelationType) => void;
}) {
  return (
    <div className="flex items-center gap-0.5 flex-wrap" role="group" aria-label="Relationship type filters">
      {ALL_RELATION_TYPES.map((t) => (
        <FilterChip
          key={t}
          label={RELATION_TYPE_LABELS[t].label}
          color={RELATION_TYPE_LABELS[t].color}
          active={activeRelTypes.has(t)}
          onClick={() => onToggle(t)}
        />
      ))}
    </div>
  );
}

function ConfidenceFilter({
  activeConfLevels,
  onToggle,
}: {
  activeConfLevels: Set<ConfidenceLevel>;
  onToggle: (c: ConfidenceLevel) => void;
}) {
  return (
    <div className="flex items-center gap-0.5 flex-wrap" role="group" aria-label="Confidence level filters">
      {ALL_CONFIDENCE_LEVELS.map((c) => (
        <FilterChip
          key={c}
          label={c}
          color={CONFIDENCE_COLORS[c]}
          active={activeConfLevels.has(c)}
          onClick={() => onToggle(c)}
        />
      ))}
    </div>
  );
}

function SearchInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative">
      <HugeiconsIcon
        icon={Search01Icon}
        size={14}
        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        type="text"
        placeholder="Search..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Search resources"
        className="h-7 w-44 pl-8 pr-7 text-xs bg-background/95 backdrop-blur-sm"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          aria-label="Clear search"
        >
          <HugeiconsIcon icon={Cancel01Icon} size={12} />
        </button>
      )}
    </div>
  );
}

function FitToViewButton({ onFitView }: { onFitView: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          onClick={onFitView}
          aria-label="Fit to view"
        >
          <HugeiconsIcon icon={ArrowShrinkIcon} size={14} />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Fit to view</TooltipContent>
    </Tooltip>
  );
}

/* ── Main toolbar ── */

export interface TopologyToolbarProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  activeRelTypes: Set<RelationType>;
  onToggleRelType: (t: RelationType) => void;
  activeConfLevels: Set<ConfidenceLevel>;
  onToggleConfLevel: (c: ConfidenceLevel) => void;
  resourceGroups: string[];
  activeRGs: Set<string>;
  onToggleRG: (rg: string) => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  onFitView: () => void;
  /** true when at least one RG is expanded in progressive mode */
  hasExpandedRGs?: boolean;
  /** collapse all expanded RGs back to overview */
  onCollapseAll?: () => void;
}

export const TopologyToolbar = memo(function TopologyToolbar({
  viewMode,
  onViewModeChange,
  activeRelTypes,
  onToggleRelType,
  activeConfLevels,
  onToggleConfLevel,
  resourceGroups,
  activeRGs,
  onToggleRG,
  searchTerm,
  onSearchChange,
  onFitView,
  hasExpandedRGs,
  onCollapseAll,
}: TopologyToolbarProps) {
  return (
    <div className="absolute top-3 left-3 right-3 z-10 flex flex-col gap-2">
      {/* Primary row */}
      <div className="flex items-center gap-2 flex-wrap">
        {hasExpandedRGs && onCollapseAll && (
          <>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[10px] font-medium gap-1"
              onClick={onCollapseAll}
            >
              ← Overview
            </Button>
            <div className="h-5 w-px bg-border" />
          </>
        )}

        <ViewModeToggle mode={viewMode} onChange={onViewModeChange} />

        <div className="h-5 w-px bg-border" />

        <ResourceGroupFilter
          resourceGroups={resourceGroups}
          activeRGs={activeRGs}
          onToggle={onToggleRG}
        />

        <div className="h-5 w-px bg-border" />

        <RelationTypeFilter
          activeRelTypes={activeRelTypes}
          onToggle={onToggleRelType}
        />

        <div className="h-5 w-px bg-border" />

        <ConfidenceFilter
          activeConfLevels={activeConfLevels}
          onToggle={onToggleConfLevel}
        />

        <div className="flex-1" />

        <SearchInput value={searchTerm} onChange={onSearchChange} />
        <FitToViewButton onFitView={onFitView} />
      </div>
    </div>
  );
});

export { ALL_RELATION_TYPES, ALL_CONFIDENCE_LEVELS, RELATION_TYPE_LABELS, CONFIDENCE_COLORS };
export type { ViewMode };
