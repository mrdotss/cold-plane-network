"use client";

import { memo, useState } from "react";
import {
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
} from "@xyflow/react";

/* ──────────────────────────────────────────────────────────────── */
/* Containment Edge — parent/child, dashed                         */
/* ──────────────────────────────────────────────────────────────── */

const ContainmentEdge = memo(function ContainmentEdge(props: EdgeProps) {
  const [hovered, setHovered] = useState(false);
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition } = props;

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
  });

  return (
    <g
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Wider invisible hit area */}
      <path d={edgePath} fill="none" stroke="transparent" strokeWidth={14} />
      <path
        d={edgePath}
        fill="none"
        stroke="#94a3b8"
        strokeWidth={hovered ? 2.5 : 1.5}
        strokeDasharray="6 4"
        opacity={hovered ? 1 : 0.6}
        style={{ transition: "all 150ms" }}
      />
      {hovered && (
        <EdgeLabelRenderer>
          <div
            className="pointer-events-none absolute rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground shadow-sm border border-border"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            }}
          >
            contains
          </div>
        </EdgeLabelRenderer>
      )}
    </g>
  );
});

/* ──────────────────────────────────────────────────────────────── */
/* Reference Edge — dependsOn/connectTo, solid with arrowhead      */
/* ──────────────────────────────────────────────────────────────── */

const ReferenceEdge = memo(function ReferenceEdge(props: EdgeProps) {
  const [hovered, setHovered] = useState(false);
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data } = props;
  const edgeKind = (data as { meta?: { edgeKind?: string } })?.meta?.edgeKind ?? "reference";

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
  });

  const markerId = `ref-arrow-${id.replace(/[^a-zA-Z0-9]/g, "_")}`;

  return (
    <g
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <defs>
        <marker
          id={markerId}
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#334155" />
        </marker>
      </defs>
      {/* Wider invisible hit area */}
      <path d={edgePath} fill="none" stroke="transparent" strokeWidth={14} />
      <path
        d={edgePath}
        fill="none"
        stroke="#334155"
        strokeWidth={hovered ? 2.5 : 1.5}
        opacity={hovered ? 1 : 0.7}
        markerEnd={`url(#${markerId})`}
        style={{ transition: "all 150ms" }}
      />
      {hovered && (
        <EdgeLabelRenderer>
          <div
            className="pointer-events-none absolute rounded bg-foreground px-1.5 py-0.5 text-[10px] font-medium text-background shadow-sm"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            }}
          >
            {edgeKind}
          </div>
        </EdgeLabelRenderer>
      )}
    </g>
  );
});

/* ──────────────────────────────────────────────────────────────── */
/* Inferred Edge — dotted, shows reasoning on hover                */
/* ──────────────────────────────────────────────────────────────── */

const InferredEdge = memo(function InferredEdge(props: EdgeProps) {
  const [hovered, setHovered] = useState(false);
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data } = props;
  const reason = (data as { meta?: { reason?: string } })?.meta?.reason ?? "same parent group";

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
  });

  return (
    <g
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Wider invisible hit area */}
      <path d={edgePath} fill="none" stroke="transparent" strokeWidth={14} />
      <path
        d={edgePath}
        fill="none"
        stroke={hovered ? "#6366f1" : "#94a3b8"}
        strokeWidth={hovered ? 2 : 1}
        strokeDasharray="3 5"
        opacity={hovered ? 0.9 : 0.5}
        style={{ transition: "all 150ms" }}
      />
      {hovered && (
        <EdgeLabelRenderer>
          <div
            className="pointer-events-none absolute rounded-md bg-primary px-2 py-1 text-[10px] font-medium text-primary-foreground shadow-md"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            }}
          >
            <span className="opacity-70">inferred:</span> {reason}
          </div>
        </EdgeLabelRenderer>
      )}
    </g>
  );
});

/** Edge types map for React Flow. */
export const topologyEdgeTypes = {
  containment: ContainmentEdge,
  reference: ReferenceEdge,
  inferred: InferredEdge,
} as const;

export { ContainmentEdge, ReferenceEdge, InferredEdge };
