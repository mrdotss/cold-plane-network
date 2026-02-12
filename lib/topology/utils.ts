import type { GraphIR } from "@/lib/contracts/graph-ir";

/** Result of diffing two Graph IRs by stable IDs. */
export interface GraphDiff {
  /** IDs present in next but not in prev. */
  added: string[];
  /** IDs present in prev but not in next. */
  removed: string[];
  /** IDs present in both but with different metadata/properties. */
  updated: string[];
}

/**
 * Compare two Graph IRs by canonical stable IDs.
 *
 * Returns added, removed, and updated node/edge IDs.
 * "Updated" means the ID exists in both graphs but the serialized
 * node/edge data differs (label change, meta change, etc.).
 */
export function diffGraphIR(prev: GraphIR, next: GraphIR): GraphDiff {
  // Build lookup maps for nodes and edges by ID
  const prevItems = new Map<string, string>();
  const nextItems = new Map<string, string>();

  for (const node of prev.nodes) {
    prevItems.set(node.id, JSON.stringify(node));
  }
  for (const edge of prev.edges) {
    prevItems.set(edge.id, JSON.stringify(edge));
  }
  for (const node of next.nodes) {
    nextItems.set(node.id, JSON.stringify(node));
  }
  for (const edge of next.edges) {
    nextItems.set(edge.id, JSON.stringify(edge));
  }

  const added: string[] = [];
  const removed: string[] = [];
  const updated: string[] = [];

  // Find added and updated
  for (const [id, serialized] of nextItems) {
    const prevSerialized = prevItems.get(id);
    if (prevSerialized === undefined) {
      added.push(id);
    } else if (prevSerialized !== serialized) {
      updated.push(id);
    }
  }

  // Find removed
  for (const id of prevItems.keys()) {
    if (!nextItems.has(id)) {
      removed.push(id);
    }
  }

  return { added, removed, updated };
}

/**
 * Check whether a diff represents a structural change (nodes/edges added or removed)
 * vs. a metadata-only change (only updates, no adds/removes).
 */
export function isStructuralChange(diff: GraphDiff): boolean {
  return diff.added.length > 0 || diff.removed.length > 0;
}
