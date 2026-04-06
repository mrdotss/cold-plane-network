"use client";

import * as React from "react";
import { ReferenceLine } from "recharts";
import { HugeiconsIcon } from "@hugeicons/react";
import { Flag01Icon } from "@hugeicons/core-free-icons";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface ChartAnnotation {
  date: string;
  content: string;
}

interface AnnotationMarkerProps {
  annotations: ChartAnnotation[];
  dataKey?: string;
}

/**
 * Custom Recharts label component rendered at each annotated date's ReferenceLine.
 * Shows a small flag icon that reveals annotation text on hover via Tooltip.
 */
function AnnotationLabel({ content: annotationText, viewBox }: {
  content: string;
  viewBox?: { x?: number; y?: number };
}) {
  const x = viewBox?.x ?? 0;

  return (
    <foreignObject x={x - 8} y={0} width={16} height={20}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className="inline-flex cursor-default items-center justify-center"
            aria-label={`Annotation: ${annotationText.length > 60 ? annotationText.slice(0, 60) + "…" : annotationText}`}
          >
            <HugeiconsIcon
              icon={Flag01Icon}
              strokeWidth={2}
              className="size-3.5 text-primary"
            />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <p className="text-xs">{annotationText}</p>
        </TooltipContent>
      </Tooltip>
    </foreignObject>
  );
}

/**
 * Renders Recharts `<ReferenceLine>` elements for each annotation.
 * Drop this inside a `<LineChart>` (or any Recharts chart) as direct children.
 *
 * Usage:
 * ```tsx
 * <LineChart data={chartData}>
 *   {renderAnnotationMarkers({ annotations, dataKey: "date" })}
 *   ...
 * </LineChart>
 * ```
 */
export function renderAnnotationMarkers({
  annotations,
  dataKey = "date",
}: AnnotationMarkerProps): React.ReactNode[] {
  if (!annotations || annotations.length === 0) return [];

  return annotations.map((annotation) => (
    <ReferenceLine
      key={`annotation-${annotation.date}`}
      x={annotation.date}
      stroke="var(--primary)"
      strokeDasharray="3 3"
      strokeOpacity={0.5}
      label={<AnnotationLabel content={annotation.content} />}
    />
  ));
}

/**
 * Standalone component wrapper — renders nothing itself but provides
 * the annotation markers as a renderable array for chart composition.
 *
 * For direct JSX usage where you need a component rather than a function:
 * ```tsx
 * <AnnotationMarker annotations={annotations} dataKey="date" />
 * ```
 */
export function AnnotationMarker({ annotations, dataKey = "date" }: AnnotationMarkerProps) {
  return <>{renderAnnotationMarkers({ annotations, dataKey })}</>;
}
