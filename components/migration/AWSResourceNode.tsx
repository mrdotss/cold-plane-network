"use client";

import React from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { AwsServiceIcon } from "@/lib/migration/aws-service-icons";
import { Badge } from "@/components/ui/badge";
import type { DualTopologyNode } from "@/lib/canvas-utils";

type AWSNodeData = DualTopologyNode["data"];

const CONFIDENCE_BADGE: Record<string, string> = {
  High: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400",
  Medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400",
  Low: "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400",
  None: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400",
};

function AWSResourceNodeInner({ data }: NodeProps<Node<AWSNodeData>>) {
  const service = data.awsService || data.label || "Unknown";
  const confidence = data.confidence ?? "None";
  const azureName = data.azureResourceName;
  const highlighted = data.highlighted;
  const dimmed = data.dimmed;

  return (
    <div
      className={`
        rounded-lg border bg-background shadow-sm
        min-w-[180px] max-w-[240px] px-3 py-2 cursor-pointer
        transition-all duration-150
        ${highlighted ? "ring-2 ring-yellow-400 shadow-lg" : ""}
        ${dimmed ? "opacity-25" : "hover:shadow-md"}
      `}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2 !h-2 !border-background !bg-slate-400"
      />
      <div className="flex items-center gap-2">
        <div className="shrink-0">
          <AwsServiceIcon service={service} size={24} />
        </div>
        <div className="min-w-0 flex-1">
          {azureName && (
            <div className="truncate text-[10px] font-medium text-foreground">
              {azureName}
            </div>
          )}
          <div className="truncate text-xs font-semibold text-foreground">
            {service}
          </div>
          <div className="flex items-center gap-1">
            <span className="truncate text-[10px] text-muted-foreground">
              {data.category}
            </span>
          </div>
        </div>
        <Badge
          variant="outline"
          className={`text-[9px] px-1.5 h-4 shrink-0 ${CONFIDENCE_BADGE[confidence] ?? ""}`}
        >
          {confidence}
        </Badge>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!w-2 !h-2 !border-background !bg-slate-400"
      />
    </div>
  );
}

export const AWSResourceNode = React.memo(AWSResourceNodeInner);
