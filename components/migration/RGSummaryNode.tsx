"use client";

import React from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { Badge } from "@/components/ui/badge";
import type { DualTopologyNode } from "@/lib/canvas-utils";

type RGSummaryData = DualTopologyNode["data"];

function RGSummaryNodeInner({ data }: NodeProps<Node<RGSummaryData>>) {
  const summary = data.rgSummary;
  const highlighted = data.highlighted ?? false;
  const dimmed = data.dimmed ?? false;

  return (
    <div
      className={`
        relative rounded-lg border border-border bg-background shadow-sm
        border-l-4 border-l-blue-500
        cursor-pointer transition-all duration-150
        hover:shadow-md
        ${highlighted ? "ring-2 ring-yellow-400" : ""}
        ${dimmed ? "opacity-25" : ""}
      `}
      style={{ width: 260 }}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-[6px] !h-[6px] !bg-blue-400 !border-0"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!w-[6px] !h-[6px] !bg-blue-400 !border-0"
      />

      <div className="px-3 py-2.5">
        {/* Header: RG name + resource count */}
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-xs font-semibold text-foreground truncate flex-1">
            {data.label}
          </span>
          <Badge variant="secondary" className="text-[9px] px-1.5 h-4 shrink-0">
            {summary?.resourceCount ?? data.childCount ?? 0}
          </Badge>
        </div>

        {/* Top resource types */}
        {summary?.topTypes && summary.topTypes.length > 0 && (
          <div className="text-[10px] text-muted-foreground mb-1">
            {summary.topTypes.map((t, i) => (
              <span key={t.type}>
                {i > 0 && " · "}
                <span className="font-medium">{t.count}</span> {t.type}
              </span>
            ))}
          </div>
        )}

        {/* Stats row */}
        <div className="flex items-center gap-3 text-[9px] text-muted-foreground">
          {summary && summary.internalRelCount > 0 && (
            <span>
              <span className="font-medium text-blue-600 dark:text-blue-400">
                {summary.internalRelCount}
              </span>{" "}
              rel
            </span>
          )}
          {summary && summary.mappingCount > 0 && (
            <span>
              <span className="font-medium text-green-600 dark:text-green-400">
                {summary.mappingCount}
              </span>{" "}
              mapped
            </span>
          )}
        </div>

        {/* Click hint */}
        <div className="mt-1 text-[9px] text-muted-foreground/60">
          Click to expand
        </div>
      </div>
    </div>
  );
}

export const RGSummaryNode = React.memo(RGSummaryNodeInner);
