/** Stable unique node in the topology graph. */
export interface GraphNode {
  /** Canonical stable ID. Format: `{type}:{name}` */
  id: string;
  /** Resource type identifier (e.g., "vpc", "subnet", "router", "firewall"). */
  type: string;
  /** Human-readable display label. */
  label: string;
  /** Optional parent group ID for containment relationships. */
  groupId?: string;
  /** Arbitrary key-value metadata from the spec. */
  meta: Record<string, unknown>;
}

/** Stable unique edge in the topology graph. */
export interface GraphEdge {
  /** Canonical stable ID. Format: `{source}:{target}:{relationType}` */
  id: string;
  /** Source node ID. */
  source: string;
  /** Target node ID. */
  target: string;
  /**
   * Relation classification:
   * - "containment" — parent/child grouping
   * - "reference" — explicit field reference
   * - "inferred" — best-effort inference
   */
  relationType: "containment" | "reference" | "inferred";
  /** Optional metadata (e.g., port, protocol, label). */
  meta: Record<string, unknown>;
}

/** Top-level graph intermediate representation. */
export interface GraphIR {
  version: "1";
  nodes: GraphNode[];
  edges: GraphEdge[];
}
