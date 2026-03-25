"use client";

import React, { useState } from "react";
import { type NodeProps, type Node } from "@xyflow/react";
import { Badge } from "@/components/ui/badge";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
import type { DualTopologyNode } from "@/lib/canvas-utils";

type RGNodeData = DualTopologyNode["data"];

const AUTO_COLLAPSE_THRESHOLD = 10;

function ResourceGroupNodeInner({ data }: NodeProps<Node<RGNodeData>>) {
  const childCount = data.childCount ?? 0;
  const [collapsed, setCollapsed] = useState(childCount > AUTO_COLLAPSE_THRESHOLD);

  return (
    <div
      className={`
        rounded-xl border-2 border-dashed border-blue-300 dark:border-blue-700
        bg-blue-50/30 dark:bg-blue-950/10
        min-w-[200px] px-3 py-2 cursor-pointer
        transition-all duration-150
      `}
      onClick={(e) => {
        e.stopPropagation();
        setCollapsed((c) => !c);
      }}
    >
      <div className="flex items-center gap-2">
        <HugeiconsIcon
          icon={collapsed ? ArrowRight01Icon : ArrowDown01Icon}
          size={14}
          className="text-blue-500 shrink-0"
        />
        <span className="text-xs font-semibold text-blue-700 dark:text-blue-300 truncate">
          {data.label}
        </span>
        <Badge variant="secondary" className="text-[9px] px-1.5 h-4 ml-auto shrink-0">
          {childCount}
        </Badge>
      </div>
      {collapsed && (
        <div className="mt-1 text-[10px] text-muted-foreground">
          {childCount} resource{childCount !== 1 ? "s" : ""} (click to expand)
        </div>
      )}
    </div>
  );
}

export const ResourceGroupNode = React.memo(ResourceGroupNodeInner);
