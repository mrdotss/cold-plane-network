import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import type { GraphIR, GraphNode, GraphEdge } from "@/lib/contracts/graph-ir";
import { diffGraphIR } from "../utils";
import { layoutGraph } from "../layout";

/**
 * Arbitrary for a valid node ID in canonical format: {type}:{name}
 */
const arbNodeId = fc
  .tuple(
    fc.stringMatching(/^[a-z]{2,6}$/),
    fc.stringMatching(/^[a-z][a-z0-9-]{0,8}$/)
  )
  .map(([type, name]) => `${type}:${name}`);

/**
 * Arbitrary for a GraphNode with a given ID.
 */
function arbNodeWithId(id: string): fc.Arbitrary<GraphNode> {
  return fc.record({
    id: fc.constant(id),
    type: fc.constant(id.split(":")[0]),
    label: fc.string({ minLength: 1, maxLength: 20 }),
    meta: fc.constant({} as Record<string, unknown>),
  });
}

/**
 * Arbitrary for a GraphIR with unique node IDs and valid edges.
 */
const arbGraphIR: fc.Arbitrary<GraphIR> = fc
  .array(arbNodeId, { minLength: 1, maxLength: 8 })
  .chain((ids) => {
    const uniqueIds = [...new Set(ids)];
    if (uniqueIds.length === 0) return fc.constant(null);

    const nodesArb = fc.tuple(
      ...uniqueIds.map((id) => arbNodeWithId(id))
    );

    // Generate edges between existing nodes
    const edgesArb =
      uniqueIds.length >= 2
        ? fc
            .array(
              fc.tuple(
                fc.constantFrom(...uniqueIds),
                fc.constantFrom(...uniqueIds),
                fc.constantFrom(
                  "containment" as const,
                  "reference" as const,
                  "inferred" as const
                )
              ),
              { minLength: 0, maxLength: 4 }
            )
            .map((tuples) => {
              const seen = new Set<string>();
              return tuples
                .filter(([s, t]) => s !== t)
                .map(([source, target, relationType]) => {
                  const id = `${source}:${target}:${relationType}`;
                  if (seen.has(id)) return null;
                  seen.add(id);
                  return {
                    id,
                    source,
                    target,
                    relationType,
                    meta: {},
                  } as GraphEdge;
                })
                .filter((e): e is GraphEdge => e !== null);
            })
        : fc.constant([] as GraphEdge[]);

    return fc.tuple(nodesArb, edgesArb).map(([nodes, edges]) => ({
      version: "1" as const,
      nodes,
      edges,
    }));
  })
  .filter((g): g is GraphIR => g !== null);

/**
 * Feature: cold-plane-mvp, Property 14: Graph IR diff correctness
 * Validates: Requirements 6.5
 *
 * For any two Graph IRs (prev and next), the diff function SHALL correctly identify:
 * (a) nodes/edges present in next but not prev as "added",
 * (b) nodes/edges present in prev but not next as "removed",
 * (c) nodes/edges present in both with different metadata as "updated".
 * The union of added, removed, and unchanged IDs SHALL equal the union of all IDs from both graphs.
 */
describe("Property 14: Graph IR diff correctness", () => {
  it("diff correctly classifies added, removed, and updated items", () => {
    fc.assert(
      fc.property(arbGraphIR, arbGraphIR, (prev, next) => {
        const diff = diffGraphIR(prev, next);

        const prevIds = new Set([
          ...prev.nodes.map((n) => n.id),
          ...prev.edges.map((e) => e.id),
        ]);
        const nextIds = new Set([
          ...next.nodes.map((n) => n.id),
          ...next.edges.map((e) => e.id),
        ]);

        // (a) Added: in next but not in prev
        for (const id of diff.added) {
          expect(nextIds.has(id)).toBe(true);
          expect(prevIds.has(id)).toBe(false);
        }

        // (b) Removed: in prev but not in next
        for (const id of diff.removed) {
          expect(prevIds.has(id)).toBe(true);
          expect(nextIds.has(id)).toBe(false);
        }

        // (c) Updated: in both
        for (const id of diff.updated) {
          expect(prevIds.has(id)).toBe(true);
          expect(nextIds.has(id)).toBe(true);
        }

        // Union of added + removed + updated + unchanged = union of all IDs
        const allIds = new Set([...prevIds, ...nextIds]);
        const diffIds = new Set([...diff.added, ...diff.removed, ...diff.updated]);

        // Every ID in allIds must be in diffIds OR be unchanged (in both, same data)
        for (const id of allIds) {
          if (!diffIds.has(id)) {
            // Must be unchanged: present in both with same data
            expect(prevIds.has(id)).toBe(true);
            expect(nextIds.has(id)).toBe(true);
          }
        }

        // No diff ID should be outside allIds
        for (const id of diffIds) {
          expect(allIds.has(id)).toBe(true);
        }
      }),
      { numRuns: 100 }
    );
  });
});


/**
 * Feature: cold-plane-mvp, Property 15: Layout stability on metadata-only changes
 * Validates: Requirements 6.6, 6.7, 14.3
 *
 * For any Graph IR, if only node metadata (label, meta fields) is changed
 * without adding or removing nodes or edges, the Layout Engine SHALL produce
 * identical node positions before and after the change.
 */
describe("Property 15: Layout stability on metadata-only changes", () => {
  it("layout positions are identical when only metadata changes", () => {
    fc.assert(
      fc.property(
        arbGraphIR,
        fc.string({ minLength: 1, maxLength: 20 }),
        (graphIR, newLabel) => {
          // Layout the original graph
          const result1 = layoutGraph(graphIR.nodes, graphIR.edges, "TB");

          // Create a metadata-only change: modify labels on all nodes
          const modifiedNodes = graphIR.nodes.map((node) => ({
            ...node,
            label: `${node.label}-${newLabel}`,
            meta: { ...node.meta, touched: true },
          }));

          // Layout with modified metadata (same structure)
          const result2 = layoutGraph(modifiedNodes, graphIR.edges, "TB");

          // Positions must be identical since structure didn't change
          expect(result1.nodes.length).toBe(result2.nodes.length);
          for (let i = 0; i < result1.nodes.length; i++) {
            expect(result1.nodes[i].position.x).toBe(result2.nodes[i].position.x);
            expect(result1.nodes[i].position.y).toBe(result2.nodes[i].position.y);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
