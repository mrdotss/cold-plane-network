"use client";

import { useMemo, useCallback } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { getResourceStyle } from "@/lib/topology/node-types";
import type { GraphIR } from "@/lib/contracts/graph-ir";
import { cn } from "@/lib/utils";

interface ResourceListProps {
  graphIR: GraphIR;
  selectedNodeId: string | null;
  onRowSelect: (nodeId: string) => void;
}

interface ResourceRow {
  id: string;
  label: string;
  type: string;
  group: string;
  connectionCount: number;
}

export function ResourceList({
  graphIR,
  selectedNodeId,
  onRowSelect,
}: ResourceListProps) {
  const rows: ResourceRow[] = useMemo(() => {
    return graphIR.nodes.map((node) => {
      const connectionCount = graphIR.edges.filter(
        (e) => e.source === node.id || e.target === node.id
      ).length;
      return {
        id: node.id,
        label: node.label,
        type: node.type,
        group: node.groupId ?? "—",
        connectionCount,
      };
    });
  }, [graphIR]);

  const handleRowClick = useCallback(
    (nodeId: string) => {
      onRowSelect(nodeId);
    },
    [onRowSelect]
  );

  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center p-4 text-xs text-muted-foreground">
        No resources to display
      </div>
    );
  }

  return (
    <div className="overflow-auto text-xs">
      <table className="w-full">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="px-2 py-1 font-medium w-6"></th>
            <th className="px-2 py-1 font-medium">Label</th>
            <th className="px-2 py-1 font-medium">Type</th>
            <th className="px-2 py-1 font-medium">Group</th>
            <th className="px-2 py-1 font-medium text-right">Edges</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const style = getResourceStyle(row.type);
            const isSelected = row.id === selectedNodeId;
            return (
              <tr
                key={row.id}
                onClick={() => handleRowClick(row.id)}
                className={cn(
                  "cursor-pointer border-b transition-colors hover:bg-muted/50",
                  isSelected && "bg-blue-50 dark:bg-blue-950/30"
                )}
              >
                <td className="px-2 py-1">
                  <div className={style.color}>
                    <HugeiconsIcon icon={style.icon} size={14} />
                  </div>
                </td>
                <td className="px-2 py-1 font-medium">{row.label}</td>
                <td className="px-2 py-1 text-muted-foreground">{row.type}</td>
                <td className="px-2 py-1 text-muted-foreground">{row.group}</td>
                <td className="px-2 py-1 text-right text-muted-foreground">
                  {row.connectionCount}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
