import { describe, it, expect } from "vitest";
import {
  buildDualTopologyGraph,
  RELATION_EDGE_STYLES,
  MAPPING_CONFIDENCE_COLORS,
} from "@/lib/canvas-utils";
import type {
  AzureResourceInput,
  AzureResourceRelationship,
} from "@/lib/migration/relationship-engine";
import type {
  AWSTopologyResult,
  MappingRecommendationInput,
} from "@/lib/migration/aws-topology-builder";

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

// ── Tests ──────────────────────────────────────────────────────────────────

describe("buildDualTopologyGraph", () => {
  it("produces Azure nodes left, AWS nodes right in dual mode", () => {
    const vmId = crypto.randomUUID();
    const nicId = crypto.randomUUID();

    const resources: AzureResourceInput[] = [
      makeResource({ id: vmId, name: "MyVM", type: "microsoft.compute/virtualmachines" }),
      makeResource({ id: nicId, name: "MyNIC", type: "microsoft.network/networkinterfaces" }),
    ];

    const relationships: AzureResourceRelationship[] = [
      { sourceResourceId: vmId, targetResourceId: nicId, relationType: "network", confidence: "High", method: "name_heuristic" },
    ];

    const mappings: MappingRecommendationInput[] = [
      { azureResourceId: vmId, awsService: "Amazon EC2", awsCategory: "Compute", confidence: "High" },
      { azureResourceId: nicId, awsService: "Elastic Network Interface", awsCategory: "Networking", confidence: "High" },
    ];

    const awsTopology: AWSTopologyResult = {
      nodes: [
        { id: `aws-${vmId}`, awsService: "Amazon EC2", awsCategory: "Compute", sourceAzureResourceId: vmId, label: "Amazon EC2", hasMappingRecommendation: true },
        { id: `aws-${nicId}`, awsService: "Elastic Network Interface", awsCategory: "Networking", sourceAzureResourceId: nicId, label: "ENI", hasMappingRecommendation: true },
      ],
      edges: [
        { id: `aws-edge-aws-${vmId}->aws-${nicId}`, sourceNodeId: `aws-${vmId}`, targetNodeId: `aws-${nicId}`, relationType: "network", confidence: "High" },
      ],
    };

    const result = buildDualTopologyGraph({
      azureResources: resources,
      azureRelationships: relationships,
      awsTopology,
      mappingRecommendations: mappings,
    });

    const azureNodes = result.nodes.filter((n) => n.type === "azure");
    const awsNodes = result.nodes.filter((n) => n.type === "aws");

    expect(azureNodes.length).toBe(2);
    expect(awsNodes.length).toBe(2);

    const maxAzureX = Math.max(...azureNodes.map((n) => n.position.x));
    const minAwsX = Math.min(...awsNodes.map((n) => n.position.x));
    expect(maxAzureX).toBeLessThan(minAwsX);
  });

  it("computes resource group bounding boxes correctly", () => {
    const id1 = crypto.randomUUID();
    const id2 = crypto.randomUUID();
    const id3 = crypto.randomUUID();

    const resources: AzureResourceInput[] = [
      makeResource({ id: id1, name: "VM1", type: "microsoft.compute/virtualmachines", resourceGroup: "rg-alpha" }),
      makeResource({ id: id2, name: "VM2", type: "microsoft.compute/virtualmachines", resourceGroup: "rg-alpha" }),
      makeResource({ id: id3, name: "VM3", type: "microsoft.compute/virtualmachines", resourceGroup: "rg-beta" }),
    ];

    const result = buildDualTopologyGraph({
      azureResources: resources,
      azureRelationships: [],
      awsTopology: { nodes: [], edges: [] },
      mappingRecommendations: [],
      filters: { viewMode: "azure-only" },
    });

    // rg-alpha should have a bounding box containing 2 nodes
    expect(result.resourceGroupBounds.has("rg-alpha")).toBe(true);
    expect(result.resourceGroupBounds.has("rg-beta")).toBe(true);

    const alphaBounds = result.resourceGroupBounds.get("rg-alpha")!;
    expect(alphaBounds.width).toBeGreaterThan(0);
    expect(alphaBounds.height).toBeGreaterThan(0);

    const betaBounds = result.resourceGroupBounds.get("rg-beta")!;
    expect(betaBounds.width).toBeGreaterThan(0);
    expect(betaBounds.height).toBeGreaterThan(0);
  });

  it("filtering by resource group hides correct nodes", () => {
    const id1 = crypto.randomUUID();
    const id2 = crypto.randomUUID();

    const resources: AzureResourceInput[] = [
      makeResource({ id: id1, name: "VM-Alpha", type: "microsoft.compute/virtualmachines", resourceGroup: "rg-alpha" }),
      makeResource({ id: id2, name: "VM-Beta", type: "microsoft.compute/virtualmachines", resourceGroup: "rg-beta" }),
    ];

    const result = buildDualTopologyGraph({
      azureResources: resources,
      azureRelationships: [],
      awsTopology: { nodes: [], edges: [] },
      mappingRecommendations: [],
      filters: { resourceGroups: ["rg-alpha"], viewMode: "azure-only" },
    });

    expect(result.nodes.length).toBe(1);
    expect(result.nodes[0].data.label).toBe("VM-Alpha");
    expect(result.nodes[0].data.resourceGroup).toBe("rg-alpha");
  });

  it("filtering by relationship type hides correct edges", () => {
    const id1 = crypto.randomUUID();
    const id2 = crypto.randomUUID();
    const id3 = crypto.randomUUID();

    const resources: AzureResourceInput[] = [
      makeResource({ id: id1, name: "VM", type: "microsoft.compute/virtualmachines", resourceGroup: "rg" }),
      makeResource({ id: id2, name: "NIC", type: "microsoft.network/networkinterfaces", resourceGroup: "rg" }),
      makeResource({ id: id3, name: "Disk", type: "microsoft.compute/disks", resourceGroup: "rg" }),
    ];

    const relationships: AzureResourceRelationship[] = [
      { sourceResourceId: id1, targetResourceId: id2, relationType: "network", confidence: "High", method: "name_heuristic" },
      { sourceResourceId: id1, targetResourceId: id3, relationType: "storage", confidence: "High", method: "name_heuristic" },
    ];

    const result = buildDualTopologyGraph({
      azureResources: resources,
      azureRelationships: relationships,
      awsTopology: { nodes: [], edges: [] },
      mappingRecommendations: [],
      filters: { relationTypes: ["network"], viewMode: "azure-only" },
    });

    expect(result.edges.length).toBe(1);
    expect(result.edges[0].data.relationType).toBe("network");
    expect(result.edges[0].data.color).toBe(RELATION_EDGE_STYLES.network.color);
  });

  it("search highlighting matches correct nodes", () => {
    const id1 = crypto.randomUUID();
    const id2 = crypto.randomUUID();
    const id3 = crypto.randomUUID();

    const resources: AzureResourceInput[] = [
      makeResource({ id: id1, name: "WebServer-VM", type: "microsoft.compute/virtualmachines", resourceGroup: "rg" }),
      makeResource({ id: id2, name: "DatabaseServer", type: "microsoft.compute/virtualmachines", resourceGroup: "rg" }),
      makeResource({ id: id3, name: "WebApp-NIC", type: "microsoft.network/networkinterfaces", resourceGroup: "rg" }),
    ];

    const result = buildDualTopologyGraph({
      azureResources: resources,
      azureRelationships: [],
      awsTopology: { nodes: [], edges: [] },
      mappingRecommendations: [],
      filters: { searchTerm: "web", viewMode: "azure-only" },
    });

    const highlighted = result.nodes.filter((n) => n.data.highlighted);
    const dimmed = result.nodes.filter((n) => n.data.dimmed);

    // "WebServer-VM" and "WebApp-NIC" match "web" (case-insensitive)
    expect(highlighted.length).toBe(2);
    expect(dimmed.length).toBe(1);

    const highlightedNames = highlighted.map((n) => n.data.label).sort();
    expect(highlightedNames).toEqual(["WebApp-NIC", "WebServer-VM"]);
  });

  it("mapping edges are created in dual mode with correct confidence colors", () => {
    const id = crypto.randomUUID();

    const resources: AzureResourceInput[] = [
      makeResource({ id, name: "MyVM", type: "microsoft.compute/virtualmachines" }),
    ];

    const mappings: MappingRecommendationInput[] = [
      { azureResourceId: id, awsService: "Amazon EC2", awsCategory: "Compute", confidence: "Medium" },
    ];

    const awsTopology: AWSTopologyResult = {
      nodes: [
        { id: `aws-${id}`, awsService: "Amazon EC2", awsCategory: "Compute", sourceAzureResourceId: id, label: "EC2", hasMappingRecommendation: true },
      ],
      edges: [],
    };

    const result = buildDualTopologyGraph({
      azureResources: resources,
      azureRelationships: [],
      awsTopology,
      mappingRecommendations: mappings,
      filters: { viewMode: "dual" },
    });

    const mappingEdges = result.edges.filter((e) => e.type === "mapping");
    expect(mappingEdges.length).toBe(1);
    expect(mappingEdges[0].data.color).toBe(MAPPING_CONFIDENCE_COLORS.Medium);
    expect(mappingEdges[0].data.animated).toBe(true);
    expect(mappingEdges[0].source).toBe(`azure-${id}`);
    expect(mappingEdges[0].target).toBe(`aws-${id}`);
  });

  it("no mapping edges in azure-only or aws-only view modes", () => {
    const id = crypto.randomUUID();

    const resources: AzureResourceInput[] = [
      makeResource({ id, name: "MyVM", type: "microsoft.compute/virtualmachines" }),
    ];

    const mappings: MappingRecommendationInput[] = [
      { azureResourceId: id, awsService: "Amazon EC2", awsCategory: "Compute", confidence: "High" },
    ];

    const awsTopology: AWSTopologyResult = {
      nodes: [
        { id: `aws-${id}`, awsService: "Amazon EC2", awsCategory: "Compute", sourceAzureResourceId: id, label: "EC2", hasMappingRecommendation: true },
      ],
      edges: [],
    };

    for (const viewMode of ["azure-only", "aws-only"] as const) {
      const result = buildDualTopologyGraph({
        azureResources: resources,
        azureRelationships: [],
        awsTopology,
        mappingRecommendations: mappings,
        filters: { viewMode },
      });

      const mappingEdges = result.edges.filter((e) => e.type === "mapping");
      expect(mappingEdges.length).toBe(0);
    }
  });

  it("empty input produces empty output", () => {
    const result = buildDualTopologyGraph({
      azureResources: [],
      azureRelationships: [],
      awsTopology: { nodes: [], edges: [] },
      mappingRecommendations: [],
    });

    expect(result.nodes.length).toBe(0);
    expect(result.edges.length).toBe(0);
    expect(result.resourceGroupBounds.size).toBe(0);
  });

  it("no-mapping placeholder nodes are typed correctly", () => {
    const vmId = crypto.randomUUID();
    const nicId = crypto.randomUUID();

    const resources: AzureResourceInput[] = [
      makeResource({ id: vmId, name: "MyVM", type: "microsoft.compute/virtualmachines" }),
      makeResource({ id: nicId, name: "MyNIC", type: "microsoft.network/networkinterfaces" }),
    ];

    const relationships: AzureResourceRelationship[] = [
      { sourceResourceId: vmId, targetResourceId: nicId, relationType: "network", confidence: "High", method: "name_heuristic" },
    ];

    // Only VM has a mapping, NIC does not
    const mappings: MappingRecommendationInput[] = [
      { azureResourceId: vmId, awsService: "Amazon EC2", awsCategory: "Compute", confidence: "High" },
    ];

    const awsTopology: AWSTopologyResult = {
      nodes: [
        { id: `aws-${vmId}`, awsService: "Amazon EC2", awsCategory: "Compute", sourceAzureResourceId: vmId, label: "Amazon EC2", hasMappingRecommendation: true },
        { id: `aws-${nicId}`, awsService: "No Mapping", awsCategory: "unmapped", sourceAzureResourceId: nicId, label: "MyNIC (No Mapping)", hasMappingRecommendation: false },
      ],
      edges: [
        { id: `aws-edge-aws-${vmId}->aws-${nicId}`, sourceNodeId: `aws-${vmId}`, targetNodeId: `aws-${nicId}`, relationType: "network", confidence: "High" },
      ],
    };

    const result = buildDualTopologyGraph({
      azureResources: resources,
      azureRelationships: relationships,
      awsTopology,
      mappingRecommendations: mappings,
    });

    const noMappingNodes = result.nodes.filter((n) => n.type === "no-mapping");
    expect(noMappingNodes.length).toBe(1);
    expect(noMappingNodes[0].data.hasMappingRecommendation).toBe(false);

    const awsMappedNodes = result.nodes.filter((n) => n.type === "aws");
    expect(awsMappedNodes.length).toBe(1);
    expect(awsMappedNodes[0].data.hasMappingRecommendation).toBe(true);
  });
});
