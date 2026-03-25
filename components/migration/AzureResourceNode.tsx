"use client";

import React from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { AzureResourceIcon, getAzureResourceCategory } from "@/lib/migration/azure-icons";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { DualTopologyNode } from "@/lib/canvas-utils";

type AzureNodeData = DualTopologyNode["data"];

function AzureResourceNodeInner({ data }: NodeProps<Node<AzureNodeData>>) {
  const resourceType = data.resourceType ?? "";
  const category = getAzureResourceCategory(resourceType);
  const highlighted = data.highlighted;
  const dimmed = data.dimmed;

  /** Shorten Azure type for display */
  const shortType = resourceType.replace(/^microsoft\./i, "");

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={`
            rounded-lg border-l-4 border bg-background shadow-sm
            min-w-[180px] max-w-[220px] px-3 py-2 cursor-pointer
            transition-all duration-150
            ${highlighted ? "ring-2 ring-yellow-400 shadow-lg" : ""}
            ${dimmed ? "opacity-25" : "hover:shadow-md"}
          `}
          style={{ borderLeftColor: category.color }}
        >
          <div className="flex items-center gap-2">
            <AzureResourceIcon resourceType={resourceType} size={18} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-semibold text-foreground">
                {data.label}
              </div>
              {shortType && (
                <div className="truncate text-[9px] font-mono text-muted-foreground">
                  {shortType}
                </div>
              )}
            </div>
          </div>
          <Handle
            type="source"
            position={Position.Right}
            className="!w-2 !h-2 !border-background"
            style={{ background: category.color }}
          />
          <Handle
            type="target"
            position={Position.Left}
            className="!w-2 !h-2 !border-background"
            style={{ background: category.color }}
          />
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="grid gap-1 text-xs">
        <span className="font-semibold">{data.label}</span>
        {resourceType && <span className="font-mono text-[10px] opacity-80">{resourceType}</span>}
        {data.location && <span>Location: {data.location}</span>}
        {data.resourceGroup && <span>RG: {data.resourceGroup}</span>}
      </TooltipContent>
    </Tooltip>
  );
}

export const AzureResourceNode = React.memo(AzureResourceNodeInner);
