import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { buildAWSTopology } from "@/lib/migration/aws-topology-builder";
import type {
  MappingRecommendationInput,
} from "@/lib/migration/aws-topology-builder";
import type {
  AzureResourceInput,
  AzureResourceRelationship,
} from "@/lib/migration/relationship-engine";

// ── Arbitrary generators ───────────────────────────────────────────────────

const arbAlphanumeric = fc
  .string({ minLength: 1, maxLength: 20 })
  .map((s) => s.replace(/[^a-z0-9]/gi, "a"))
  .filter((s) => s.length >= 1);

const arbRelationType = fc.constantFrom(
  "contains" as const,
  "network" as const,
  "storage" as const,
  "security" as const,
  "gateway" as const,
  "monitoring" as const,
);

const arbConfidence = fc.constantFrom(
  "Definite" as const,
  "High" as const,
  "Medium" as const,
  "Low" as const,
);

const arbMethod = fc.constantFrom(
  "arm_hierarchy" as const,
  "property_ref" as const,
  "name_heuristic" as const,
  "rg_heuristic" as const,
);

const arbAwsService = fc.constantFrom(
  "Amazon EC2",
  "Amazon EBS",
  "Elastic Network Interface",
  "Elastic IP Address",
  "Amazon VPC",
  "VPC Security Groups",
  "Application Load Balancer",
  "Amazon EKS",
);

const arbAwsCategory = fc.constantFrom(
  "Compute",
  "Storage",
  "Networking",
  "Security",
  "Containers",
);

// ── Helpers ────────────────────────────────────────────────────────────────

function makeResource(
  overrides: Partial<AzureResourceInput> & { name: string; type: string },
): AzureResourceInput {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    name: overrides.name,
    type: overrides.type,
    location: overrides.location ?? null,
    resourceGroup: overrides.resourceGroup ?? null,
    armId: overrides.armId ?? null,
    raw: overrides.raw ?? "{}",
  };
}

// ── Property 9: AWS topology builder node generation and edge mirroring ────

/**
 * **Validates: Requirements 8.1, 8.2, 8.4**
 *
 * Property 9: AWS topology builder node generation and edge mirroring
 *
 * For any set of Azure relationships where both the source and target resources
 * have mapping recommendations, the AWS topology builder SHALL:
 * - Generate exactly one AWS node per Azure resource that has a mapping recommendation
 * - Create a mirrored AWS edge for each Azure relationship where both endpoints have AWS nodes
 * - Use the correct AWS service type mapping
 */

describe("Property 9: AWS topology builder node generation and edge mirroring", () => {
  it("generates exactly one AWS node per Azure resource with a mapping recommendation", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            name: arbAlphanumeric,
            awsService: arbAwsService,
            awsCategory: arbAwsCategory,
          }),
          { minLength: 1, maxLength: 10 },
        ),
        (resourceDefs) => {
          // Create unique Azure resources with mapping recommendations
          const resources: AzureResourceInput[] = [];
          const mappings: MappingRecommendationInput[] = [];

          for (const def of resourceDefs) {
            const id = crypto.randomUUID();
            resources.push(
              makeResource({
                id,
                name: def.name,
                type: "microsoft.compute/virtualmachines",
              }),
            );
            mappings.push({
              azureResourceId: id,
              awsService: def.awsService,
              awsCategory: def.awsCategory,
              confidence: "High",
            });
          }

          const result = buildAWSTopology([], mappings, resources);

          // Exactly one AWS node per mapped Azure resource
          expect(result.nodes.length).toBe(resources.length);

          // Every node has hasMappingRecommendation: true
          for (const node of result.nodes) {
            expect(node.hasMappingRecommendation).toBe(true);
          }

          // Every mapped Azure resource has a corresponding AWS node
          const sourceIds = new Set(result.nodes.map((n) => n.sourceAzureResourceId));
          for (const res of resources) {
            expect(sourceIds.has(res.id)).toBe(true);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("creates a mirrored AWS edge for each Azure relationship where both endpoints have mappings", () => {
    fc.assert(
      fc.property(
        arbAlphanumeric,
        arbAlphanumeric,
        arbAwsService,
        arbAwsService,
        arbAwsCategory,
        arbRelationType,
        arbConfidence,
        arbMethod,
        (vmName, nicName, vmAwsService, nicAwsService, category, relType, confidence, method) => {
          const vmId = crypto.randomUUID();
          const nicId = crypto.randomUUID();

          const resources: AzureResourceInput[] = [
            makeResource({ id: vmId, name: vmName, type: "microsoft.compute/virtualmachines" }),
            makeResource({ id: nicId, name: nicName, type: "microsoft.network/networkinterfaces" }),
          ];

          const mappings: MappingRecommendationInput[] = [
            { azureResourceId: vmId, awsService: vmAwsService, awsCategory: category, confidence: "High" },
            { azureResourceId: nicId, awsService: nicAwsService, awsCategory: category, confidence: "High" },
          ];

          const relationships: AzureResourceRelationship[] = [
            {
              sourceResourceId: vmId,
              targetResourceId: nicId,
              relationType: relType,
              confidence,
              method,
            },
          ];

          const result = buildAWSTopology(relationships, mappings, resources);

          // Should have exactly 2 nodes (both mapped)
          expect(result.nodes.length).toBe(2);

          // Should have exactly 1 mirrored edge
          expect(result.edges.length).toBe(1);

          const edge = result.edges[0];
          expect(edge.sourceNodeId).toBe(`aws-${vmId}`);
          expect(edge.targetNodeId).toBe(`aws-${nicId}`);
          expect(edge.relationType).toBe(relType);
          expect(edge.confidence).toBe(confidence);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("AWS node service names match the mapping recommendation service names", () => {
    fc.assert(
      fc.property(
        arbAlphanumeric,
        arbAwsService,
        arbAwsCategory,
        (name, awsService, awsCategory) => {
          const id = crypto.randomUUID();

          const resources: AzureResourceInput[] = [
            makeResource({ id, name, type: "microsoft.compute/virtualmachines" }),
          ];

          const mappings: MappingRecommendationInput[] = [
            { azureResourceId: id, awsService, awsCategory, confidence: "High" },
          ];

          // Need a relationship so the resource participates
          const result = buildAWSTopology([], mappings, resources);

          expect(result.nodes.length).toBe(1);
          expect(result.nodes[0].awsService).toBe(awsService);
          expect(result.nodes[0].awsCategory).toBe(awsCategory);
          expect(result.nodes[0].label).toBe(awsService);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("produces deterministic output: calling twice with same input yields identical results", () => {
    fc.assert(
      fc.property(
        arbAlphanumeric,
        arbAlphanumeric,
        arbAwsService,
        arbAwsService,
        arbAwsCategory,
        arbRelationType,
        arbConfidence,
        arbMethod,
        (vmName, nicName, vmSvc, nicSvc, cat, relType, conf, method) => {
          const vmId = crypto.randomUUID();
          const nicId = crypto.randomUUID();

          const resources: AzureResourceInput[] = [
            makeResource({ id: vmId, name: vmName, type: "microsoft.compute/virtualmachines" }),
            makeResource({ id: nicId, name: nicName, type: "microsoft.network/networkinterfaces" }),
          ];

          const mappings: MappingRecommendationInput[] = [
            { azureResourceId: vmId, awsService: vmSvc, awsCategory: cat, confidence: "High" },
            { azureResourceId: nicId, awsService: nicSvc, awsCategory: cat, confidence: "High" },
          ];

          const relationships: AzureResourceRelationship[] = [
            { sourceResourceId: vmId, targetResourceId: nicId, relationType: relType, confidence: conf, method },
          ];

          const result1 = buildAWSTopology(relationships, mappings, resources);
          const result2 = buildAWSTopology(relationships, mappings, resources);

          expect(result1.nodes).toEqual(result2.nodes);
          expect(result1.edges).toEqual(result2.edges);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ── Property 10: AWS topology builder no-mapping placeholder ───────────────

/**
 * **Validates: Requirements 8.3**
 *
 * Property 10: AWS topology builder no-mapping placeholder
 *
 * For any Azure resource that participates in a relationship but has no mapping
 * recommendation, the AWS topology builder SHALL generate a "No Mapping"
 * placeholder node with `hasMappingRecommendation: false` on the AWS side.
 */

describe("Property 10: AWS topology builder no-mapping placeholder", () => {
  it("creates a placeholder node for resources in relationships without mapping recommendations", () => {
    fc.assert(
      fc.property(
        arbAlphanumeric,
        arbAlphanumeric,
        arbAwsService,
        arbAwsCategory,
        arbRelationType,
        arbConfidence,
        arbMethod,
        (mappedName, unmappedName, awsService, awsCategory, relType, confidence, method) => {
          const mappedId = crypto.randomUUID();
          const unmappedId = crypto.randomUUID();

          const resources: AzureResourceInput[] = [
            makeResource({ id: mappedId, name: mappedName, type: "microsoft.compute/virtualmachines" }),
            makeResource({ id: unmappedId, name: unmappedName, type: "microsoft.network/networkinterfaces" }),
          ];

          // Only the first resource has a mapping
          const mappings: MappingRecommendationInput[] = [
            { azureResourceId: mappedId, awsService, awsCategory, confidence: "High" },
          ];

          const relationships: AzureResourceRelationship[] = [
            { sourceResourceId: mappedId, targetResourceId: unmappedId, relationType: relType, confidence, method },
          ];

          const result = buildAWSTopology(relationships, mappings, resources);

          // Should have 2 nodes: one mapped, one placeholder
          expect(result.nodes.length).toBe(2);

          const mappedNode = result.nodes.find((n) => n.sourceAzureResourceId === mappedId);
          const placeholderNode = result.nodes.find((n) => n.sourceAzureResourceId === unmappedId);

          expect(mappedNode).toBeDefined();
          expect(mappedNode!.hasMappingRecommendation).toBe(true);
          expect(mappedNode!.awsService).toBe(awsService);

          expect(placeholderNode).toBeDefined();
          expect(placeholderNode!.hasMappingRecommendation).toBe(false);
          expect(placeholderNode!.awsService).toBe("No Mapping");
          expect(placeholderNode!.awsCategory).toBe("unmapped");
        },
      ),
      { numRuns: 100 },
    );
  });

  it("does NOT create placeholder nodes for resources that have no relationships", () => {
    fc.assert(
      fc.property(
        arbAlphanumeric,
        arbAlphanumeric,
        arbAwsService,
        arbAwsCategory,
        (mappedName, isolatedName, awsService, awsCategory) => {
          const mappedId = crypto.randomUUID();
          const isolatedId = crypto.randomUUID();

          const resources: AzureResourceInput[] = [
            makeResource({ id: mappedId, name: mappedName, type: "microsoft.compute/virtualmachines" }),
            makeResource({ id: isolatedId, name: isolatedName, type: "microsoft.network/networkinterfaces" }),
          ];

          // Only the first resource has a mapping, and there are no relationships
          const mappings: MappingRecommendationInput[] = [
            { azureResourceId: mappedId, awsService, awsCategory, confidence: "High" },
          ];

          const result = buildAWSTopology([], mappings, resources);

          // Only the mapped resource should have a node (no placeholder for isolated resource)
          expect(result.nodes.length).toBe(1);
          expect(result.nodes[0].sourceAzureResourceId).toBe(mappedId);
          expect(result.nodes[0].hasMappingRecommendation).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("placeholder node label includes the Azure resource name", () => {
    fc.assert(
      fc.property(
        arbAlphanumeric,
        arbAlphanumeric,
        arbAwsService,
        arbAwsCategory,
        arbRelationType,
        arbConfidence,
        arbMethod,
        (mappedName, unmappedName, awsService, awsCategory, relType, confidence, method) => {
          const mappedId = crypto.randomUUID();
          const unmappedId = crypto.randomUUID();

          const resources: AzureResourceInput[] = [
            makeResource({ id: mappedId, name: mappedName, type: "microsoft.compute/virtualmachines" }),
            makeResource({ id: unmappedId, name: unmappedName, type: "microsoft.network/networkinterfaces" }),
          ];

          const mappings: MappingRecommendationInput[] = [
            { azureResourceId: mappedId, awsService, awsCategory, confidence: "High" },
          ];

          const relationships: AzureResourceRelationship[] = [
            { sourceResourceId: mappedId, targetResourceId: unmappedId, relationType: relType, confidence, method },
          ];

          const result = buildAWSTopology(relationships, mappings, resources);

          const placeholderNode = result.nodes.find((n) => n.sourceAzureResourceId === unmappedId);
          expect(placeholderNode).toBeDefined();
          expect(placeholderNode!.label).toContain(unmappedName);
          expect(placeholderNode!.label).toContain("No Mapping");
        },
      ),
      { numRuns: 100 },
    );
  });
});
