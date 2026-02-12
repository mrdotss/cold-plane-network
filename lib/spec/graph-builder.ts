import type { GraphIR, GraphNode, GraphEdge } from "@/lib/contracts/graph-ir";
import type { ParsedSpec, SpecDiagnostic } from "./schema";

/**
 * Sanitize a string for use in canonical IDs.
 * Lowercase, alphanumeric + hyphens + colons only.
 */
function sanitizeId(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9:-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Build a canonical node ID: `{type}:{name}`
 */
function nodeId(type: string, name: string): string {
  return `${sanitizeId(type)}:${sanitizeId(name)}`;
}

/**
 * Build a canonical edge ID: `{source}:{target}:{relationType}`
 */
function edgeId(
  source: string,
  target: string,
  relationType: GraphEdge["relationType"]
): string {
  return `${source}:${target}:${relationType}`;
}

export interface BuildGraphResult {
  graphIR: GraphIR;
  diagnostics: SpecDiagnostic[];
}

/**
 * Transform a ParsedSpec into a GraphIR.
 *
 * Edge resolution priority:
 * 1. Containment — parent/child from `children` nesting
 * 2. Reference — explicit `dependsOn` and `connectTo` fields
 * 3. Inferred — resources in the same group that likely communicate
 *
 * Emits info-level diagnostics for every inferred edge.
 */
export function buildGraphIR(parsed: ParsedSpec): BuildGraphResult {
  const diagnostics: SpecDiagnostic[] = [];
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const edgeSet = new Set<string>();

  // Track connected pairs (direction-independent) to prevent duplicate edges
  // between the same two nodes from dependsOn + connectTo
  const connectedPairs = new Set<string>();

  // Map resource name → canonical node ID for reference resolution
  const nameToNodeId = new Map<string, string>();

  // Build nodes
  for (const resource of parsed.resources) {
    const id = nodeId(resource.type, resource.name);
    const parentId = resource.parent
      ? nameToNodeId.get(resource.parent) ?? undefined
      : undefined;

    nameToNodeId.set(resource.name, id);

    const node: GraphNode = {
      id,
      type: resource.type,
      label: resource.name,
      meta: { ...resource.properties },
    };

    if (parentId) {
      node.groupId = parentId;
    }

    nodes.push(node);
  }

  // Helper: canonical pair key (direction-independent)
  function pairKey(a: string, b: string): string {
    return a < b ? `${a}||${b}` : `${b}||${a}`;
  }

  // Helper to add an edge if not already present
  function addEdge(
    source: string,
    target: string,
    relationType: GraphEdge["relationType"],
    meta: Record<string, unknown> = {}
  ): boolean {
    const id = edgeId(source, target, relationType);
    if (edgeSet.has(id)) return false;
    edgeSet.add(id);
    connectedPairs.add(pairKey(source, target));
    edges.push({ id, source, target, relationType, meta });
    return true;
  }

  // Helper: check if two nodes are already connected in any direction
  function hasAnyEdge(a: string, b: string): boolean {
    return connectedPairs.has(pairKey(a, b));
  }

  // 1. Containment edges — from parent/child relationships
  for (const resource of parsed.resources) {
    if (resource.parent) {
      const childId = nameToNodeId.get(resource.name);
      const parentNodeId = nameToNodeId.get(resource.parent);
      if (childId && parentNodeId) {
        addEdge(parentNodeId, childId, "containment");
      }
    }
  }

  // 2. Reference edges — from dependsOn and connectTo
  for (const resource of parsed.resources) {
    const sourceId = nameToNodeId.get(resource.name);
    if (!sourceId) continue;

    if (resource.dependsOn) {
      for (const dep of resource.dependsOn) {
        const targetId = nameToNodeId.get(dep);
        if (targetId && !hasAnyEdge(sourceId, targetId)) {
          // dependsOn: edge goes FROM dependency TO dependent (parent → child direction)
          addEdge(targetId, sourceId, "reference", { edgeKind: "dependsOn" });
        }
      }
    }

    if (resource.connectTo) {
      for (const conn of resource.connectTo) {
        const targetId = nameToNodeId.get(conn);
        if (targetId && !hasAnyEdge(sourceId, targetId)) {
          addEdge(sourceId, targetId, "reference", { edgeKind: "connectTo" });
        }
      }
    }
  }

  // 3. Inferred edges — resources in the same group that likely communicate
  const groupChildren = new Map<string, string[]>();
  for (const resource of parsed.resources) {
    const group = resource.parent ?? "__root__";
    if (!groupChildren.has(group)) {
      groupChildren.set(group, []);
    }
    groupChildren.get(group)!.push(resource.name);
  }

  for (const [, siblings] of groupChildren) {
    if (siblings.length < 2 || siblings.length > 5) continue;

    for (let i = 0; i < siblings.length; i++) {
      for (let j = i + 1; j < siblings.length; j++) {
        const aId = nameToNodeId.get(siblings[i]);
        const bId = nameToNodeId.get(siblings[j]);
        if (!aId || !bId) continue;

        // Skip if there's already ANY edge between them (any direction, any type)
        if (hasAnyEdge(aId, bId)) continue;

        const added = addEdge(aId, bId, "inferred");
        if (added) {
          diagnostics.push({
            severity: "info",
            message: `Inferred connection between "${siblings[i]}" and "${siblings[j]}" (same group)`,
            nodeId: aId,
          });
        }
      }
    }
  }

  return {
    graphIR: {
      version: "1",
      nodes,
      edges,
    },
    diagnostics,
  };
}
