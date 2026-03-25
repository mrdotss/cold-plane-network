"use client";

import React from "react";
import {
  BaseEdge,
  getBezierPath,
  type EdgeProps,
  type Edge,
} from "@xyflow/react";
import type { DualTopologyEdge } from "@/lib/canvas-utils";

type MappingEdgeData = DualTopologyEdge["data"];

function MappingEdgeInner({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
}: EdgeProps<Edge<MappingEdgeData>>) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const color = data?.color ?? "#22c55e";
  const strokeWidth = data?.strokeWidth ?? 1.5;

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      markerEnd={markerEnd}
      style={{
        stroke: color,
        strokeWidth,
        strokeDasharray: "8 4",
        opacity: 0.6,
        animation: "dashmove 0.5s linear infinite",
      }}
    />
  );
}

export const MappingEdge = React.memo(MappingEdgeInner);
