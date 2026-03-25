import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { buildDualTopologyGraph } from "@/lib/canvas-utils";
import type { DualTopologyInput } from "@/lib/canvas-utils";
import type {
  AzureResourceInput,
  AzureResourceRelationship,
  RelationType,
  ConfidenceLevel,
} from "@/lib/migration/relationship-engine";
import type {
  AWSTopologyResult,
  MappingRecommendationInput,
} from "@/lib/migration/aws-topology-builder";

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
);

const arbAwsCategory = fc.constantFrom(
  "Compute",
  "Storage",
  "Networking",
  "Security",
);

// ── Helpers ────────────────────────────────────────────────────────────────

function makeResource(
  overrides: Partial<AzureResourceInput> & { name: string; type: string },
): AzureResourceInput {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    name: overrides.name,
    type: overrides.type,
    location: overrides.location ?? "eastus",
    resourceGroup: overrides.resourceGroup ?? "rg-default",
    armId: overrides.armId ?? null,
    raw: overrides.raw ?? "{}",
  };
}

function buildSimpleDualInput(
  resourceCount: number,
  opts?: {
    withRelationships?: boolean;
    withMappings?: boolean;
    resourceGroup?: string;
  },
): {
  resources: AzureResourceInput[];
  relationships: AzureResourceRelationship[];
  mappings: MappingRecommendationInput[];
  awsTopology: AWSTopologyResult;
} {
  const resources: AzureResourceInput[] = [];
  const relationships: AzureResourceRelationship[] = [];
  const mappings: MappingRecommendationInput[] = [];
  const awsNodes: AWSTopologyResult["nodes"] = [];
  const awsEdges: AWSTopologyResult["edges"] = [];

  for (let i = 0; i < resourceCount; i++) {
    const id = crypto.randomUUID();
    resources.push(
      makeResource({
        id,
        name: `resource-${i}`,
        type: "microsoft.compute/virtualmachines",
        resourceGroup: opts?.resourceGroup ?? "rg-default",
      }),
    );

    if (opts?.withMappings !== false) {
      mappings.push({
        azureResourceId: id,
        awsService: "Amazon EC2",
        awsCategory: "Compute",
        confidence: "High",
      });
      awsNodes.push({
        id: `aws-${id}`,
        awsService: "Amazon EC2",
        awsCategory: "Compute",
        sourceAzureResourceId: id,
        label: "Amazon EC2",
        hasMappingRecommendation: true,
      });
    }
  }

  if (opts?.withRelationships && resources.length >= 2) {
    for (let i = 0; i < resources.length - 1; i++) {
      relationships.push({
        sourceResourceId: resources[i].id,
        targetResourceId: resources[i + 1].id,
        relationType: "network",
        confidence: "High",
        method: "name_heuristic",
      });
      if (opts?.withMappings !== false) {
        awsEdges.push({
          id: `aws-edge-aws-${resources[i].id}->aws-${resources[i + 1].id}`,
          sourceNodeId: `aws-${resources[i].id}`,
          targetNodeId: `aws-${resources[i + 1].id}`,
          relationType: "network",
          confidence: "High",
        });
      }
    }
  }

  return {
    resources,
    relationships,
    mappings,
    awsTopology: { nodes: awsNodes, edges: awsEdges },
  };
}


// ── Property 11: Dual topology layout Azure-left AWS-right ─────────────────

/**
 * **Validates: Requirements 7.1, 9.1**
 *
 * Property 11: Dual topology layout Azure-left AWS-right
 *
 * For any non-empty dual topology graph produced by buildDualTopologyGraph,
 * all Azure-type nodes SHALL have x-positions strictly less than all AWS-type
 * nodes' x-positions, ensuring the three-column layout.
 */

describe("Property 11: Dual topology layout Azure-left AWS-right", () => {
  it("all Azure nodes have x-positions strictly less than all AWS nodes", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 8 }),
        (count) => {
          const { resources, relationships, mappings, awsTopology } =
            buildSimpleDualInput(count, { withRelationships: true, withMappings: true });

          const result = buildDualTopologyGraph({
            azureResources: resources,
            azureRelationships: relationships,
            awsTopology,
            mappingRecommendations: mappings,
          });

          const azureNodes = result.nodes.filter((n) => n.type === "azure");
          const awsNodes = result.nodes.filter((n) => n.type === "aws" || n.type === "no-mapping");

          if (azureNodes.length === 0 || awsNodes.length === 0) return;

          const maxAzureX = Math.max(...azureNodes.map((n) => n.position.x));
          const minAwsX = Math.min(...awsNodes.map((n) => n.position.x));

          expect(maxAzureX).toBeLessThan(minAwsX);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("Azure nodes are grouped on the left side in dual view mode", () => {
    fc.assert(
      fc.property(
        arbAlphanumeric,
        arbAlphanumeric,
        arbAwsService,
        arbAwsCategory,
        arbRelationType,
        arbConfidence,
        arbMethod,
        (azureName1, azureName2, awsSvc, awsCat, relType, conf, method) => {
          const id1 = crypto.randomUUID();
          const id2 = crypto.randomUUID();

          const resources: AzureResourceInput[] = [
            makeResource({ id: id1, name: azureName1, type: "microsoft.compute/virtualmachines" }),
            makeResource({ id: id2, name: azureName2, type: "microsoft.network/networkinterfaces" }),
          ];

          const mappings: MappingRecommendationInput[] = [
            { azureResourceId: id1, awsService: awsSvc, awsCategory: awsCat, confidence: "High" },
            { azureResourceId: id2, awsService: "Elastic Network Interface", awsCategory: "Networking", confidence: "High" },
          ];

          const relationships: AzureResourceRelationship[] = [
            { sourceResourceId: id1, targetResourceId: id2, relationType: relType, confidence: conf, method },
          ];

          const awsTopology: AWSTopologyResult = {
            nodes: [
              { id: `aws-${id1}`, awsService: awsSvc, awsCategory: awsCat, sourceAzureResourceId: id1, label: awsSvc, hasMappingRecommendation: true },
              { id: `aws-${id2}`, awsService: "Elastic Network Interface", awsCategory: "Networking", sourceAzureResourceId: id2, label: "ENI", hasMappingRecommendation: true },
            ],
            edges: [
              { id: `aws-edge-aws-${id1}->aws-${id2}`, sourceNodeId: `aws-${id1}`, targetNodeId: `aws-${id2}`, relationType: relType, confidence: conf },
            ],
          };

          const result = buildDualTopologyGraph({
            azureResources: resources,
            azureRelationships: relationships,
            awsTopology,
            mappingRecommendations: mappings,
            filters: { viewMode: "dual" },
          });

          const azureXs = result.nodes.filter((n) => n.type === "azure").map((n) => n.position.x);
          const awsXs = result.nodes.filter((n) => n.type === "aws").map((n) => n.position.x);

          if (azureXs.length > 0 && awsXs.length > 0) {
            expect(Math.max(...azureXs)).toBeLessThan(Math.min(...awsXs));
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("azure-only view mode produces zero AWS nodes", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5 }),
        (count) => {
          const { resources, relationships, mappings, awsTopology } =
            buildSimpleDualInput(count, { withRelationships: true, withMappings: true });

          const result = buildDualTopologyGraph({
            azureResources: resources,
            azureRelationships: relationships,
            awsTopology,
            mappingRecommendations: mappings,
            filters: { viewMode: "azure-only" },
          });

          const awsNodes = result.nodes.filter((n) => n.type === "aws" || n.type === "no-mapping");
          expect(awsNodes.length).toBe(0);
          expect(result.nodes.filter((n) => n.type === "azure").length).toBe(count);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("aws-only view mode produces zero Azure nodes", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5 }),
        (count) => {
          const { resources, relationships, mappings, awsTopology } =
            buildSimpleDualInput(count, { withRelationships: true, withMappings: true });

          const result = buildDualTopologyGraph({
            azureResources: resources,
            azureRelationships: relationships,
            awsTopology,
            mappingRecommendations: mappings,
            filters: { viewMode: "aws-only" },
          });

          const azureNodes = result.nodes.filter((n) => n.type === "azure");
          expect(azureNodes.length).toBe(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});


// ── Property 12: Canvas filtering correctness ──────────────────────────────

/**
 * **Validates: Requirements 10.1, 10.2, 10.3**
 *
 * Property 12: Canvas filtering correctness
 *
 * For any dual topology graph and any combination of filters:
 * - When a resource group filter is active, only nodes belonging to selected
 *   resource groups (and their associated relationships and AWS mirror nodes)
 *   SHALL be visible
 * - When a relationship type filter is active, only edges of the selected types
 *   SHALL be visible on both Azure and AWS sides
 * - When a confidence level filter is active, only relationship edges matching
 *   the selected confidence levels SHALL be visible
 */

describe("Property 12: Canvas filtering correctness", () => {
  it("resource group filter hides nodes not in selected groups", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 4 }),
        fc.integer({ min: 1, max: 4 }),
        (countRG1, countRG2) => {
          // Create resources in two different resource groups
          const rg1Resources: AzureResourceInput[] = [];
          const rg2Resources: AzureResourceInput[] = [];

          for (let i = 0; i < countRG1; i++) {
            rg1Resources.push(
              makeResource({
                name: `rg1-res-${i}`,
                type: "microsoft.compute/virtualmachines",
                resourceGroup: "rg-alpha",
              }),
            );
          }
          for (let i = 0; i < countRG2; i++) {
            rg2Resources.push(
              makeResource({
                name: `rg2-res-${i}`,
                type: "microsoft.compute/virtualmachines",
                resourceGroup: "rg-beta",
              }),
            );
          }

          const allResources = [...rg1Resources, ...rg2Resources];

          const result = buildDualTopologyGraph({
            azureResources: allResources,
            azureRelationships: [],
            awsTopology: { nodes: [], edges: [] },
            mappingRecommendations: [],
            filters: { resourceGroups: ["rg-alpha"], viewMode: "azure-only" },
          });

          // Only rg-alpha nodes should be visible
          const azureNodes = result.nodes.filter((n) => n.type === "azure");
          expect(azureNodes.length).toBe(countRG1);
          for (const node of azureNodes) {
            expect(node.data.resourceGroup).toBe("rg-alpha");
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("relationship type filter hides edges of non-selected types", () => {
    fc.assert(
      fc.property(
        arbRelationType,
        arbRelationType,
        (allowedType, otherType) => {
          // Skip if both types are the same — can't test filtering
          if (allowedType === otherType) return;

          const id1 = crypto.randomUUID();
          const id2 = crypto.randomUUID();
          const id3 = crypto.randomUUID();

          const resources: AzureResourceInput[] = [
            makeResource({ id: id1, name: "res1", type: "microsoft.compute/virtualmachines", resourceGroup: "rg" }),
            makeResource({ id: id2, name: "res2", type: "microsoft.network/networkinterfaces", resourceGroup: "rg" }),
            makeResource({ id: id3, name: "res3", type: "microsoft.compute/disks", resourceGroup: "rg" }),
          ];

          const relationships: AzureResourceRelationship[] = [
            { sourceResourceId: id1, targetResourceId: id2, relationType: allowedType, confidence: "High", method: "name_heuristic" },
            { sourceResourceId: id1, targetResourceId: id3, relationType: otherType, confidence: "High", method: "name_heuristic" },
          ];

          const result = buildDualTopologyGraph({
            azureResources: resources,
            azureRelationships: relationships,
            awsTopology: { nodes: [], edges: [] },
            mappingRecommendations: [],
            filters: { relationTypes: [allowedType], viewMode: "azure-only" },
          });

          // Only edges of the allowed type should be present
          const relEdges = result.edges.filter((e) => e.type === "relationship");
          expect(relEdges.length).toBe(1);
          expect(relEdges[0].data.relationType).toBe(allowedType);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("confidence level filter hides edges of non-selected confidence", () => {
    fc.assert(
      fc.property(
        arbConfidence,
        arbConfidence,
        (allowedConf, otherConf) => {
          if (allowedConf === otherConf) return;

          const id1 = crypto.randomUUID();
          const id2 = crypto.randomUUID();
          const id3 = crypto.randomUUID();

          const resources: AzureResourceInput[] = [
            makeResource({ id: id1, name: "res1", type: "microsoft.compute/virtualmachines", resourceGroup: "rg" }),
            makeResource({ id: id2, name: "res2", type: "microsoft.network/networkinterfaces", resourceGroup: "rg" }),
            makeResource({ id: id3, name: "res3", type: "microsoft.compute/disks", resourceGroup: "rg" }),
          ];

          const relationships: AzureResourceRelationship[] = [
            { sourceResourceId: id1, targetResourceId: id2, relationType: "network", confidence: allowedConf, method: "name_heuristic" },
            { sourceResourceId: id1, targetResourceId: id3, relationType: "storage", confidence: otherConf, method: "name_heuristic" },
          ];

          const result = buildDualTopologyGraph({
            azureResources: resources,
            azureRelationships: relationships,
            awsTopology: { nodes: [], edges: [] },
            mappingRecommendations: [],
            filters: { confidenceLevels: [allowedConf], viewMode: "azure-only" },
          });

          const relEdges = result.edges.filter((e) => e.type === "relationship");
          expect(relEdges.length).toBe(1);
          expect(relEdges[0].data.confidence).toBe(allowedConf);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("RG filter also hides corresponding AWS mirror nodes", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 3 }),
        fc.integer({ min: 1, max: 3 }),
        (countRG1, countRG2) => {
          const rg1Resources: AzureResourceInput[] = [];
          const rg2Resources: AzureResourceInput[] = [];
          const mappings: MappingRecommendationInput[] = [];
          const awsNodes: AWSTopologyResult["nodes"] = [];

          for (let i = 0; i < countRG1; i++) {
            const id = crypto.randomUUID();
            rg1Resources.push(
              makeResource({ id, name: `rg1-${i}`, type: "microsoft.compute/virtualmachines", resourceGroup: "rg-alpha" }),
            );
            mappings.push({ azureResourceId: id, awsService: "Amazon EC2", awsCategory: "Compute", confidence: "High" });
            awsNodes.push({ id: `aws-${id}`, awsService: "Amazon EC2", awsCategory: "Compute", sourceAzureResourceId: id, label: "EC2", hasMappingRecommendation: true });
          }
          for (let i = 0; i < countRG2; i++) {
            const id = crypto.randomUUID();
            rg2Resources.push(
              makeResource({ id, name: `rg2-${i}`, type: "microsoft.compute/virtualmachines", resourceGroup: "rg-beta" }),
            );
            mappings.push({ azureResourceId: id, awsService: "Amazon EC2", awsCategory: "Compute", confidence: "High" });
            awsNodes.push({ id: `aws-${id}`, awsService: "Amazon EC2", awsCategory: "Compute", sourceAzureResourceId: id, label: "EC2", hasMappingRecommendation: true });
          }

          const result = buildDualTopologyGraph({
            azureResources: [...rg1Resources, ...rg2Resources],
            azureRelationships: [],
            awsTopology: { nodes: awsNodes, edges: [] },
            mappingRecommendations: mappings,
            filters: { resourceGroups: ["rg-alpha"], viewMode: "dual" },
          });

          // AWS nodes should only be for rg-alpha resources
          const awsResultNodes = result.nodes.filter((n) => n.type === "aws");
          expect(awsResultNodes.length).toBe(countRG1);
        },
      ),
      { numRuns: 100 },
    );
  });
});


// ── Property 13: Canvas search highlighting ────────────────────────────────

/**
 * **Validates: Requirements 10.4**
 *
 * Property 13: Canvas search highlighting
 *
 * For any dual topology graph and any non-empty search term, the set of
 * highlighted nodes SHALL be exactly those nodes (across both Azure and AWS
 * topologies) whose labels contain the search term as a case-insensitive
 * substring.
 */

describe("Property 13: Canvas search highlighting", () => {
  it("highlighted nodes are exactly those whose labels contain the search term (case-insensitive)", () => {
    fc.assert(
      fc.property(
        fc.array(arbAlphanumeric, { minLength: 2, maxLength: 8 }),
        fc.integer({ min: 0, max: 7 }),
        (names, pickIdx) => {
          // Pick a search term from one of the names
          const searchSource = names[pickIdx % names.length];
          // Use a substring of the name as the search term
          const searchTerm = searchSource.substring(0, Math.max(1, Math.floor(searchSource.length / 2)));

          const resources: AzureResourceInput[] = names.map((name, i) =>
            makeResource({
              name: `${name}-${i}`,
              type: "microsoft.compute/virtualmachines",
              resourceGroup: "rg",
            }),
          );

          const result = buildDualTopologyGraph({
            azureResources: resources,
            azureRelationships: [],
            awsTopology: { nodes: [], edges: [] },
            mappingRecommendations: [],
            filters: { searchTerm, viewMode: "azure-only" },
          });

          for (const node of result.nodes) {
            const shouldMatch = node.data.label.toLowerCase().includes(searchTerm.toLowerCase());
            expect(node.data.highlighted).toBe(shouldMatch);
            expect(node.data.dimmed).toBe(!shouldMatch);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("empty search term does not highlight or dim any nodes", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5 }),
        (count) => {
          const { resources } = buildSimpleDualInput(count);

          const result = buildDualTopologyGraph({
            azureResources: resources,
            azureRelationships: [],
            awsTopology: { nodes: [], edges: [] },
            mappingRecommendations: [],
            filters: { searchTerm: "", viewMode: "azure-only" },
          });

          for (const node of result.nodes) {
            expect(node.data.highlighted).toBeUndefined();
            expect(node.data.dimmed).toBeUndefined();
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("search highlighting applies across both Azure and AWS nodes in dual mode", () => {
    fc.assert(
      fc.property(
        arbAlphanumeric,
        (name) => {
          const id = crypto.randomUUID();
          const searchTerm = name.substring(0, Math.max(1, Math.floor(name.length / 2)));

          const resources: AzureResourceInput[] = [
            makeResource({ id, name, type: "microsoft.compute/virtualmachines", resourceGroup: "rg" }),
          ];

          const awsLabel = "Amazon EC2";
          const mappings: MappingRecommendationInput[] = [
            { azureResourceId: id, awsService: awsLabel, awsCategory: "Compute", confidence: "High" },
          ];

          const awsTopology: AWSTopologyResult = {
            nodes: [
              { id: `aws-${id}`, awsService: awsLabel, awsCategory: "Compute", sourceAzureResourceId: id, label: awsLabel, hasMappingRecommendation: true },
            ],
            edges: [],
          };

          const result = buildDualTopologyGraph({
            azureResources: resources,
            azureRelationships: [],
            awsTopology,
            mappingRecommendations: mappings,
            filters: { searchTerm, viewMode: "dual" },
          });

          for (const node of result.nodes) {
            const shouldMatch = node.data.label.toLowerCase().includes(searchTerm.toLowerCase());
            expect(node.data.highlighted).toBe(shouldMatch);
            expect(node.data.dimmed).toBe(!shouldMatch);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
