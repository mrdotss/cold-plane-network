"use client";

import React from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon } from "@hugeicons/core-free-icons";
import type { DualTopologyNode } from "@/lib/canvas-utils";

type NoMappingData = DualTopologyNode["data"];

function NoMappingNodeInner({ data }: NodeProps<Node<NoMappingData>>) {
  return (
    <div
      className="
        rounded-lg border border-dashed border-gray-300 dark:border-gray-600
        bg-gray-50 dark:bg-gray-900/40
        min-w-[160px] max-w-[200px] px-3 py-2 opacity-50
      "
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2 !h-2 !border-background !bg-gray-400"
      />
      <div className="flex items-center gap-2">
        <HugeiconsIcon icon={Cancel01Icon} size={16} className="text-gray-400 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs text-muted-foreground">
            {data.label}
          </div>
          <div className="text-[9px] text-muted-foreground/60">No AWS mapping</div>
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!w-2 !h-2 !border-background !bg-gray-400"
      />
    </div>
  );
}

export const NoMappingNode = React.memo(NoMappingNodeInner);
