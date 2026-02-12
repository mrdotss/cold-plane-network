"use client";

import { memo } from "react";
import {
  BaseEdge,
  getSmoothStepPath,
  type EdgeProps,
} from "@xyflow/react";

/**
 * Edge styles per relationType:
 * - containment → dashed, muted color
 * - reference → solid, default color
 * - inferred → dotted, with info styling
 */

/** Custom edge for containment relationships (dashed, muted). */
const ContainmentEdge = memo(function ContainmentEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
}: EdgeProps) {
  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      style={{
        strokeDasharray: "5 5",
        stroke: "hsl(var(--muted-foreground))",
        opacity: 0.6,
        strokeWidth: 1.5,
      }}
    />
  );
});

/** Custom edge for explicit reference relationships (solid). */
const ReferenceEdge = memo(function ReferenceEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
}: EdgeProps) {
  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      style={{
        stroke: "hsl(var(--foreground))",
        opacity: 0.7,
        strokeWidth: 1.5,
      }}
    />
  );
});

/** Custom edge for inferred relationships (dotted). */
const InferredEdge = memo(function InferredEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
}: EdgeProps) {
  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      style={{
        strokeDasharray: "2 4",
        stroke: "hsl(var(--muted-foreground))",
        opacity: 0.5,
        strokeWidth: 1,
      }}
    />
  );
});

/** Edge types map for React Flow. */
export const topologyEdgeTypes = {
  containment: ContainmentEdge,
  reference: ReferenceEdge,
  inferred: InferredEdge,
} as const;

export { ContainmentEdge, ReferenceEdge, InferredEdge };
