import type { GraphNode, GraphEdge } from "@/lib/contracts/graph-ir";

/** A GraphNode with computed x/y position from layout. */
export interface PositionedNode extends GraphNode {
  position: { x: number; y: number };
  width: number;
  height: number;
}

/** Layout direction: top-bottom or left-right. */
export type LayoutDirection = "TB" | "LR";

/** Default node dimensions. */
const DEFAULT_NODE_WIDTH = 172;
const DEFAULT_NODE_HEIGHT = 36;
const NODE_SEP = 50;
const RANK_SEP = 50;
const MARGIN = 20;

/**
 * Compute auto-layout positions for graph nodes using a simple hierarchical layout.
 *
 * Uses topological sorting to assign ranks, then spaces nodes within each rank.
 * Only call this when the graph structure changes (node/edge add/remove),
 * NOT on metadata-only updates.
 */
export function layoutGraph(
  nodes: GraphNode[],
  edges: GraphEdge[],
  direction: LayoutDirection = "TB"
): { nodes: PositionedNode[]; edges: GraphEdge[] } {
  if (nodes.length === 0) {
    return { nodes: [], edges };
  }

  // Build adjacency for topological rank assignment
  const nodeIds = new Set(nodes.map((n) => n.id));
  const inDegree = new Map<string, number>();
  const children = new Map<string, string[]>();

  for (const n of nodes) {
    inDegree.set(n.id, 0);
    children.set(n.id, []);
  }

  for (const e of edges) {
    // Only use containment and dependsOn edges for rank assignment.
    // connectTo edges are peer connections and inferred edges are best-effort —
    // neither should affect the hierarchy.
    if (e.relationType === "inferred") continue;
    if (e.relationType === "reference" && e.meta?.edgeKind === "connectTo") continue;
    if (nodeIds.has(e.source) && nodeIds.has(e.target)) {
      inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1);
      children.get(e.source)?.push(e.target);
    }
  }

  // Assign ranks via BFS (Kahn's algorithm for topological ordering)
  const rank = new Map<string, number>();
  const queue: string[] = [];

  for (const n of nodes) {
    if ((inDegree.get(n.id) ?? 0) === 0) {
      queue.push(n.id);
      rank.set(n.id, 0);
    }
  }

  let idx = 0;
  while (idx < queue.length) {
    const current = queue[idx++];
    const currentRank = rank.get(current) ?? 0;
    for (const child of children.get(current) ?? []) {
      const newIn = (inDegree.get(child) ?? 1) - 1;
      inDegree.set(child, newIn);
      // Take the max rank from all parents
      const existingRank = rank.get(child);
      const candidateRank = currentRank + 1;
      if (existingRank === undefined || candidateRank > existingRank) {
        rank.set(child, candidateRank);
      }
      if (newIn === 0) {
        queue.push(child);
      }
    }
  }

  // Assign rank 0 to any unranked nodes (cycles or disconnected)
  for (const n of nodes) {
    if (!rank.has(n.id)) {
      rank.set(n.id, 0);
    }
  }

  // Group nodes by rank
  const rankGroups = new Map<number, GraphNode[]>();
  for (const n of nodes) {
    const r = rank.get(n.id) ?? 0;
    if (!rankGroups.has(r)) rankGroups.set(r, []);
    rankGroups.get(r)!.push(n);
  }

  // Compute positions
  const sortedRanks = [...rankGroups.keys()].sort((a, b) => a - b);
  const positionedNodes: PositionedNode[] = [];

  for (const r of sortedRanks) {
    const group = rankGroups.get(r)!;
    const groupWidth =
      group.length * DEFAULT_NODE_WIDTH +
      (group.length - 1) * NODE_SEP;
    const startX = MARGIN + (groupWidth > 0 ? -groupWidth / 2 : 0);

    for (let i = 0; i < group.length; i++) {
      const node = group[i];
      const x = startX + i * (DEFAULT_NODE_WIDTH + NODE_SEP);
      const y = MARGIN + r * (DEFAULT_NODE_HEIGHT + RANK_SEP);

      const pos =
        direction === "LR" ? { x: y, y: x } : { x, y };

      positionedNodes.push({
        ...node,
        position: pos,
        width: DEFAULT_NODE_WIDTH,
        height: DEFAULT_NODE_HEIGHT,
      });
    }
  }

  return { nodes: positionedNodes, edges };
}
