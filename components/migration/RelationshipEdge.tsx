"use client";

import React from "react";
import {
  BaseEdge,
  getBezierPath,
  type EdgeProps,
  type Edge,
} from "@xyflow/react";
import type { DualTopologyEdge } from "@/lib/canvas-utils";

type RelEdgeData = DualTopologyEdge["data"];

function RelationshipEdgeInner({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
}: EdgeProps<Edge<RelEdgeData>>) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const color = data?.color ?? "#94a3b8";
  const strokeDasharray = data?.strokeDasharray ?? "none";
  const strokeWidth = data?.strokeWidth ?? 1.5;

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      markerEnd={markerEnd}
      style={{
        stroke: color,
        strokeWidth,
        strokeDasharray,
        opacity: 0.7,
      }}
    />
  );
}

export const RelationshipEdge = React.memo(RelationshipEdgeInner);
