"use client";

import { useCallback, useMemo } from "react";
import {
  ReactFlow,
  Controls,
  Background,
  BackgroundVariant,
  ConnectionMode,
  type NodeMouseHandler,
  type NodeChange,
  type Connection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { topologyNodeTypes } from "@/lib/topology/node-types";
import { topologyEdgeTypes } from "@/lib/topology/edge-types";
import type { Node, Edge } from "@xyflow/react";

interface TopologyCanvasProps {
  nodes: Node[];
  edges: Edge[];
  selectedNodeId: string | null;
  onNodeSelect: (nodeId: string | null) => void;
  onNodesChange?: (changes: NodeChange[]) => void;
  onConnect?: (connection: Connection) => void;
  onConnectStart?: (nodeId: string | null) => void;
}

export function TopologyCanvas({
  nodes,
  edges,
  selectedNodeId,
  onNodeSelect,
  onNodesChange,
  onConnect,
  onConnectStart,
}: TopologyCanvasProps) {
  // Memoize node/edge types to prevent React Flow re-registration
  const nodeTypes = useMemo(() => topologyNodeTypes, []);
  const edgeTypes = useMemo(() => topologyEdgeTypes, []);

  // Apply selection state to nodes
  const nodesWithSelection = useMemo(
    () =>
      nodes.map((n) => ({
        ...n,
        selected: n.id === selectedNodeId,
      })),
    [nodes, selectedNodeId]
  );

  const handleNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      onNodeSelect(node.id);
    },
    [onNodeSelect]
  );

  const handlePaneClick = useCallback(() => {
    onNodeSelect(null);
  }, [onNodeSelect]);

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodesWithSelection}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        onNodesChange={onNodesChange}
        onConnect={onConnect}
        onConnectStart={(_event, params) => onConnectStart?.(params.nodeId)}
        connectionMode={ConnectionMode.Loose}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Controls
          showInteractive={false}
          className="!bg-background !border !border-border !shadow-sm"
        />
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
      </ReactFlow>
    </div>
  );
}
