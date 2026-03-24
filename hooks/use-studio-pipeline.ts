"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import type { GraphIR } from "@/lib/contracts/graph-ir";
import type { ArtifactManifest } from "@/lib/contracts/artifact-manifest";
import type { ParsedSpec, SpecDiagnostic } from "@/lib/spec/schema";
import { parseSpec } from "@/lib/spec/parser";
import { validateSpec } from "@/lib/spec/validator";
import { buildGraphIR, type BuildGraphResult } from "@/lib/spec/graph-builder";
import { diffGraphIR, isStructuralChange } from "@/lib/topology/utils";
import { layoutGraph, type PositionedNode } from "@/lib/topology/layout";
import type { Node, Edge } from "@xyflow/react";

const DEBOUNCE_MS = 200;

const EMPTY_GRAPH: GraphIR = { version: "1", nodes: [], edges: [] };

export interface StudioState {
  specText: string;
  setSpecText: (text: string) => void;
  parsedSpec: ParsedSpec | null;
  diagnostics: SpecDiagnostic[];
  graphIR: GraphIR;
  flowNodes: Node[];
  flowEdges: Edge[];
  artifacts: ArtifactManifest | null;
  setArtifacts: (m: ArtifactManifest | null) => void;
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
  showInferredEdges: boolean;
  setShowInferredEdges: (show: boolean) => void;
  hasErrors: boolean;
  isEmpty: boolean;
}

/**
 * Core Studio pipeline hook.
 * Manages: specText → debounce → parse → validate → buildGraph → diff → layout → React Flow state.
 */
export function useStudioPipeline(initialSpec: string = ""): StudioState {
  const [specText, setSpecTextRaw] = useState(initialSpec);
  const [parsedSpec, setParsedSpec] = useState<ParsedSpec | null>(null);
  const [diagnostics, setDiagnostics] = useState<SpecDiagnostic[]>([]);
  const [graphIR, setGraphIR] = useState<GraphIR>(EMPTY_GRAPH);
  const [flowNodes, setFlowNodes] = useState<Node[]>([]);
  const [flowEdges, setFlowEdges] = useState<Edge[]>([]);
  const [artifacts, setArtifacts] = useState<ArtifactManifest | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [showInferredEdges, setShowInferredEdges] = useState(true);

  const prevGraphRef = useRef<GraphIR>(EMPTY_GRAPH);
  const prevPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setSpecText = useCallback((text: string) => {
    setSpecTextRaw(text);
  }, []);

  // Debounced pipeline: parse → validate → build graph → diff → layout
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      if (!specText.trim()) {
        setParsedSpec(null);
        setDiagnostics([]);
        setGraphIR(EMPTY_GRAPH);
        setFlowNodes([]);
        setFlowEdges([]);
        prevGraphRef.current = EMPTY_GRAPH;
        prevPositionsRef.current = new Map();
        return;
      }

      // 1. Parse
      const parsed = parseSpec(specText);
      setParsedSpec(parsed);

      // 2. Validate
      const validationDiags = validateSpec(parsed);
      const allDiags = [...parsed.errors, ...validationDiags];

      // 3. Build Graph IR
      let buildResult: BuildGraphResult = { graphIR: EMPTY_GRAPH, diagnostics: [] };
      if (parsed.resources.length > 0) {
        buildResult = buildGraphIR(parsed);
      }
      allDiags.push(...buildResult.diagnostics);
      setDiagnostics(allDiags);
      setGraphIR(buildResult.graphIR);

      // 4. Diff against previous graph
      const diff = diffGraphIR(prevGraphRef.current, buildResult.graphIR);
      const structural = isStructuralChange(diff);

      // 5. Layout (only on structural changes)
      let positionedNodes: PositionedNode[];
      if (structural || prevPositionsRef.current.size === 0) {
        const layoutResult = layoutGraph(buildResult.graphIR.nodes, buildResult.graphIR.edges);
        positionedNodes = layoutResult.nodes;
        // Cache positions
        const posMap = new Map<string, { x: number; y: number }>();
        for (const n of positionedNodes) {
          posMap.set(n.id, n.position);
        }
        prevPositionsRef.current = posMap;
      } else {
        // Reuse cached positions, just update metadata
        positionedNodes = buildResult.graphIR.nodes.map((n) => ({
          ...n,
          position: prevPositionsRef.current.get(n.id) ?? { x: 0, y: 0 },
          width: 180,
          height: 48,
        }));
      }

      // 6. Convert to React Flow nodes/edges
      // Note: Do NOT set `measured` — let React Flow measure actual DOM dimensions
      // so handle positions are accurate for edge path calculation.
      const newFlowNodes: Node[] = positionedNodes.map((n) => ({
        id: n.id,
        type: "topology",
        position: n.position,
        data: {
          label: n.label,
          resourceType: n.type,
          meta: n.meta,
        },
      }));

      const newFlowEdges: Edge[] = buildResult.graphIR.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        type: e.relationType,
        data: { meta: e.meta, relationType: e.relationType },
        animated: e.relationType === "inferred",
      }));

      setFlowNodes(newFlowNodes);
      setFlowEdges(newFlowEdges);
      prevGraphRef.current = buildResult.graphIR;
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [specText]);

  const hasErrors = useMemo(
    () => diagnostics.some((d) => d.severity === "error"),
    [diagnostics]
  );

  const isEmpty = useMemo(() => !specText.trim(), [specText]);

  return {
    specText,
    setSpecText,
    parsedSpec,
    diagnostics,
    graphIR,
    flowNodes,
    flowEdges,
    artifacts,
    setArtifacts,
    selectedNodeId,
    setSelectedNodeId,
    showInferredEdges,
    setShowInferredEdges,
    hasErrors,
    isEmpty,
  };
}
