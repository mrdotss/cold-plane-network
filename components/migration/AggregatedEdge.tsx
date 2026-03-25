"use client";

import React from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
  type Edge,
} from "@xyflow/react";
import type { DualTopologyEdge } from "@/lib/canvas-utils";

type AggEdgeData = DualTopologyEdge["data"];

function AggregatedEdgeInner({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps<Edge<AggEdgeData>>) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const color = data?.color ?? "#64748b";
  const strokeWidth = data?.strokeWidth ?? 2.5;
  const strokeDasharray = data?.strokeDasharray ?? "6 4";
  const count = data?.aggregatedCount ?? 0;

  return (
    <>
      <BaseEdge
        path={edgePath}
        style={{
          stroke: color,
          strokeWidth,
          strokeDasharray,
          opacity: 0.6,
        }}
      />
      {count > 0 && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: "all",
            }}
            className="
              rounded-full bg-slate-100 dark:bg-slate-800
              border border-slate-300 dark:border-slate-600
              px-1.5 py-0.5 text-[9px] font-medium text-slate-600 dark:text-slate-300
              shadow-sm
            "
          >
            {count}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const AggregatedEdge = React.memo(AggregatedEdgeInner);
