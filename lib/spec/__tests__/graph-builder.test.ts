import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { parseSpec } from "../parser";
import { buildGraphIR } from "../graph-builder";
import { RESOURCE_TYPES } from "../schema";

/**
 * Arbitrary for a valid resource name: lowercase alpha start, alphanumeric + hyphens.
 */
const arbResourceName = fc
  .stringMatching(/^[a-z][a-z0-9-]{0,14}$/)
  .filter((s) => s.length > 0);

const arbResourceType = fc.constantFrom(...RESOURCE_TYPES);

/**
 * Generate a valid YAML spec with unique names and known types.
 * Returns both the YAML text and the expected resource count.
 */
const arbValidSpecWithCount = fc
  .array(
    fc.record({
      name: arbResourceName,
      type: arbResourceType,
    }),
    { minLength: 1, maxLength: 8 }
  )
  .map((entries) => {
    const seen = new Set<string>();
    const unique = entries.filter((e) => {
      const key = e.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (unique.length === 0) return null;

    const lines = ["resources:"];
    for (const entry of unique) {
      lines.push(`  - name: ${entry.name}`);
      lines.push(`    type: ${entry.type}`);
      lines.push(`    properties: {}`);
    }
    return { text: lines.join("\n"), count: unique.length };
  })
  .filter((v): v is { text: string; count: number } => v !== null);

/**
 * Generate a valid YAML spec with a parent and children to produce inferred edges.
 * Children are siblings under the same parent, which triggers inference.
 */
const arbSpecWithInferredEdges = fc
  .record({
    parentName: arbResourceName,
    parentType: arbResourceType,
    child1Name: arbResourceName,
    child1Type: arbResourceType,
    child2Name: arbResourceName,
    child2Type: arbResourceType,
  })
  .filter(
    (r) =>
      r.parentName !== r.child1Name &&
      r.parentName !== r.child2Name &&
      r.child1Name !== r.child2Name
  )
  .map((r) => {
    const lines = [
      "resources:",
      `  - name: ${r.parentName}`,
      `    type: ${r.parentType}`,
      `    properties: {}`,
      `    children:`,
      `      - name: ${r.child1Name}`,
      `        type: ${r.child1Type}`,
      `        properties: {}`,
      `      - name: ${r.child2Name}`,
      `        type: ${r.child2Type}`,
      `        properties: {}`,
    ];
    return lines.join("\n");
  });

/**
 * Feature: cold-plane-mvp, Property 11: Graph node count matches resource count
 * Validates: Requirements 6.1
 *
 * For any valid parsed spec, the number of nodes in the Graph IR
 * produced by buildGraphIR SHALL equal the number of resources in the parsed spec.
 */
describe("Property 11: Graph node count matches resource count", () => {
  it("node count equals resource count for any valid spec", () => {
    fc.assert(
      fc.property(arbValidSpecWithCount, ({ text, count }) => {
        const parsed = parseSpec(text);
        expect(parsed.errors.filter((d) => d.severity === "error")).toHaveLength(0);

        const { graphIR } = buildGraphIR(parsed);
        expect(graphIR.nodes).toHaveLength(count);
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: cold-plane-mvp, Property 12: Inferred edges produce info diagnostics
 * Validates: Requirements 6.2, 6.3
 *
 * For any Graph IR produced by buildGraphIR that contains inferred edges,
 * there SHALL be exactly one info-level diagnostic emitted for each inferred edge.
 */
describe("Property 12: Inferred edges produce info diagnostics", () => {
  it("each inferred edge has a corresponding info diagnostic", () => {
    fc.assert(
      fc.property(arbSpecWithInferredEdges, (specText) => {
        const parsed = parseSpec(specText);
        expect(parsed.errors.filter((d) => d.severity === "error")).toHaveLength(0);

        const { graphIR, diagnostics } = buildGraphIR(parsed);
        const inferredEdges = graphIR.edges.filter(
          (e) => e.relationType === "inferred"
        );
        const infoDiagnostics = diagnostics.filter(
          (d) => d.severity === "info"
        );

        expect(infoDiagnostics).toHaveLength(inferredEdges.length);
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: cold-plane-mvp, Property 13: Stable ID determinism (idempotence)
 * Validates: Requirements 6.4
 *
 * For any valid spec text, parsing and building the Graph IR twice
 * SHALL produce identical sets of node IDs and edge IDs.
 */
describe("Property 13: Stable ID determinism (idempotence)", () => {
  it("building graph IR twice produces identical IDs", () => {
    fc.assert(
      fc.property(arbValidSpecWithCount, ({ text }) => {
        const parsed1 = parseSpec(text);
        const parsed2 = parseSpec(text);

        const { graphIR: ir1 } = buildGraphIR(parsed1);
        const { graphIR: ir2 } = buildGraphIR(parsed2);

        const nodeIds1 = ir1.nodes.map((n) => n.id).sort();
        const nodeIds2 = ir2.nodes.map((n) => n.id).sort();
        expect(nodeIds1).toEqual(nodeIds2);

        const edgeIds1 = ir1.edges.map((e) => e.id).sort();
        const edgeIds2 = ir2.edges.map((e) => e.id).sort();
        expect(edgeIds1).toEqual(edgeIds2);
      }),
      { numRuns: 100 }
    );
  });
});
