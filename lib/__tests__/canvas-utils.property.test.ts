import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { buildCanvasGraph, type AzureResourceWithRecommendation } from "@/lib/canvas-utils";

// Generator: a resource with 1+ recommendations pointing to unique AWS services
const recommendationArb = fc.record({
  awsService: fc.string({ minLength: 1, maxLength: 30 }),
  awsCategory: fc.constantFrom("Compute", "Storage", "Networking", "Database"),
  confidence: fc.constantFrom("High", "Medium", "Low", "None"),
  rationale: fc.string(),
  migrationNotes: fc.string(),
  alternatives: fc.array(fc.string(), { maxLength: 2 }),
});

const resourceArb = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 30 }),
  type: fc.string({ minLength: 1, maxLength: 50 }),
  location: fc.option(fc.string({ minLength: 1 }), { nil: null }),
  recommendations: fc.array(recommendationArb, { minLength: 1, maxLength: 3 }),
});

const resourceListArb = fc.array(resourceArb, { minLength: 1, maxLength: 8 });

describe("Property 7: Canvas graph structure with AWS deduplication", () => {
  /**
   * **Validates: Requirements 5.1, 5.2**
   * One Azure node per resource, one AWS node per unique service name (with count),
   * one edge per resource-to-service mapping.
   */
  it("produces correct node and edge counts with deduplication", () => {
    fc.assert(
      fc.property(resourceListArb, (resources) => {
        const { nodes, edges } = buildCanvasGraph(resources as AzureResourceWithRecommendation[]);

        const azureNodes = nodes.filter((n) => n.type === "azure");
        const awsNodes = nodes.filter((n) => n.type === "aws");

        // One Azure node per resource
        expect(azureNodes.length).toBe(resources.length);

        // Collect all unique AWS service names across all recommendations
        const allAwsServices = new Set<string>();
        let totalEdges = 0;
        for (const r of resources) {
          for (const rec of r.recommendations) {
            if (rec.awsService) {
              allAwsServices.add(rec.awsService);
              totalEdges++;
            }
          }
        }

        // One AWS node per unique service
        expect(awsNodes.length).toBe(allAwsServices.size);

        // One edge per resource-to-service mapping
        expect(edges.length).toBe(totalEdges);

        // AWS nodes have count reflecting how many resources map to them
        for (const awsNode of awsNodes) {
          const serviceName = awsNode.data.label;
          let expectedCount = 0;
          for (const r of resources) {
            for (const rec of r.recommendations) {
              if (rec.awsService === serviceName) expectedCount++;
            }
          }
          expect(awsNode.data.count).toBe(expectedCount);
        }
      }),
      { numRuns: 100 }
    );
  });
});

describe("Property 8: Dagre layout produces left-to-right positioning", () => {
  /**
   * **Validates: Requirements 5.4**
   * After layout, all Azure nodes have x-positions strictly less than all AWS nodes.
   */
  it("azure nodes are positioned left of aws nodes", () => {
    fc.assert(
      fc.property(resourceListArb, (resources) => {
        const { nodes } = buildCanvasGraph(resources as AzureResourceWithRecommendation[]);

        const azureNodes = nodes.filter((n) => n.type === "azure");
        const awsNodes = nodes.filter((n) => n.type === "aws");

        if (azureNodes.length > 0 && awsNodes.length > 0) {
          const maxAzureX = Math.max(...azureNodes.map((n) => n.position.x));
          const minAwsX = Math.min(...awsNodes.map((n) => n.position.x));
          expect(maxAzureX).toBeLessThan(minAwsX);
        }
      }),
      { numRuns: 100 }
    );
  });
});
