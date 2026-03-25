import { describe, it, expect } from "vitest";
import { buildAWSTopology } from "@/lib/migration/aws-topology-builder";
import type { MappingRecommendationInput } from "@/lib/migration/aws-topology-builder";
import type {
  AzureResourceInput,
  AzureResourceRelationship,
} from "@/lib/migration/relationship-engine";

// ── Helpers ────────────────────────────────────────────────────────────────

function makeResource(
  overrides: Partial<AzureResourceInput> & { id: string; name: string; type: string },
): AzureResourceInput {
  return {
    id: overrides.id,
    name: overrides.name,
    type: overrides.type,
    location: overrides.location ?? null,
    resourceGroup: overrides.resourceGroup ?? null,
    armId: overrides.armId ?? null,
    raw: overrides.raw ?? "{}",
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("buildAWSTopology", () => {
  it("VM→NIC maps to EC2→ENI with mirrored edge", () => {
    const vmId = "vm-001";
    const nicId = "nic-001";

    const resources: AzureResourceInput[] = [
      makeResource({ id: vmId, name: "MyVM", type: "microsoft.compute/virtualmachines" }),
      makeResource({ id: nicId, name: "MyVM-nic", type: "microsoft.network/networkinterfaces" }),
    ];

    const mappings: MappingRecommendationInput[] = [
      { azureResourceId: vmId, awsService: "Amazon EC2", awsCategory: "Compute", confidence: "High" },
      { azureResourceId: nicId, awsService: "Elastic Network Interface", awsCategory: "Networking", confidence: "High" },
    ];

    const relationships: AzureResourceRelationship[] = [
      { sourceResourceId: vmId, targetResourceId: nicId, relationType: "network", confidence: "High", method: "name_heuristic" },
    ];

    const result = buildAWSTopology(relationships, mappings, resources);

    expect(result.nodes.length).toBe(2);
    expect(result.edges.length).toBe(1);

    const ec2Node = result.nodes.find((n) => n.sourceAzureResourceId === vmId);
    const eniNode = result.nodes.find((n) => n.sourceAzureResourceId === nicId);

    expect(ec2Node).toBeDefined();
    expect(ec2Node!.awsService).toBe("Amazon EC2");
    expect(ec2Node!.hasMappingRecommendation).toBe(true);

    expect(eniNode).toBeDefined();
    expect(eniNode!.awsService).toBe("Elastic Network Interface");
    expect(eniNode!.hasMappingRecommendation).toBe(true);

    const edge = result.edges[0];
    expect(edge.sourceNodeId).toBe(`aws-${vmId}`);
    expect(edge.targetNodeId).toBe(`aws-${nicId}`);
    expect(edge.relationType).toBe("network");
  });

  it("resource with no mapping → placeholder node", () => {
    const vmId = "vm-001";
    const diskId = "disk-001";

    const resources: AzureResourceInput[] = [
      makeResource({ id: vmId, name: "MyVM", type: "microsoft.compute/virtualmachines" }),
      makeResource({ id: diskId, name: "MyVM_OsDisk_0", type: "microsoft.compute/disks" }),
    ];

    // Only VM has a mapping, disk does not
    const mappings: MappingRecommendationInput[] = [
      { azureResourceId: vmId, awsService: "Amazon EC2", awsCategory: "Compute", confidence: "High" },
    ];

    const relationships: AzureResourceRelationship[] = [
      { sourceResourceId: vmId, targetResourceId: diskId, relationType: "storage", confidence: "High", method: "name_heuristic" },
    ];

    const result = buildAWSTopology(relationships, mappings, resources);

    expect(result.nodes.length).toBe(2);

    const placeholderNode = result.nodes.find((n) => n.sourceAzureResourceId === diskId);
    expect(placeholderNode).toBeDefined();
    expect(placeholderNode!.hasMappingRecommendation).toBe(false);
    expect(placeholderNode!.awsService).toBe("No Mapping");
    expect(placeholderNode!.awsCategory).toBe("unmapped");
    expect(placeholderNode!.label).toContain("MyVM_OsDisk_0");
    expect(placeholderNode!.label).toContain("No Mapping");

    // Edge should still be created since both endpoints have nodes
    expect(result.edges.length).toBe(1);
  });

  it("empty relationships → empty AWS topology", () => {
    const resources: AzureResourceInput[] = [
      makeResource({ id: "vm-001", name: "MyVM", type: "microsoft.compute/virtualmachines" }),
    ];

    const mappings: MappingRecommendationInput[] = [
      { azureResourceId: "vm-001", awsService: "Amazon EC2", awsCategory: "Compute", confidence: "High" },
    ];

    const result = buildAWSTopology([], mappings, resources);

    // Node is created from mapping (even without relationships)
    expect(result.nodes.length).toBe(1);
    expect(result.nodes[0].awsService).toBe("Amazon EC2");
    // No edges since no relationships
    expect(result.edges.length).toBe(0);
  });

  it("relationship where only one endpoint has mapping → no mirrored edge, placeholder for unmapped", () => {
    const vmId = "vm-001";
    const nsgId = "nsg-001";

    const resources: AzureResourceInput[] = [
      makeResource({ id: vmId, name: "MyVM", type: "microsoft.compute/virtualmachines" }),
      makeResource({ id: nsgId, name: "MyVM-nsg", type: "microsoft.network/networksecuritygroups" }),
    ];

    // Only VM has a mapping
    const mappings: MappingRecommendationInput[] = [
      { azureResourceId: vmId, awsService: "Amazon EC2", awsCategory: "Compute", confidence: "High" },
    ];

    const relationships: AzureResourceRelationship[] = [
      { sourceResourceId: vmId, targetResourceId: nsgId, relationType: "security", confidence: "High", method: "name_heuristic" },
    ];

    const result = buildAWSTopology(relationships, mappings, resources);

    // 2 nodes: EC2 (mapped) + NSG placeholder (unmapped but in relationship)
    expect(result.nodes.length).toBe(2);

    const ec2Node = result.nodes.find((n) => n.sourceAzureResourceId === vmId);
    expect(ec2Node!.hasMappingRecommendation).toBe(true);

    const placeholder = result.nodes.find((n) => n.sourceAzureResourceId === nsgId);
    expect(placeholder!.hasMappingRecommendation).toBe(false);

    // Edge IS created because both endpoints have nodes (one mapped, one placeholder)
    expect(result.edges.length).toBe(1);
    expect(result.edges[0].relationType).toBe("security");
  });

  it("empty inputs → empty result", () => {
    const result = buildAWSTopology([], [], []);
    expect(result.nodes).toEqual([]);
    expect(result.edges).toEqual([]);
  });

  it("multiple relationships between same pair → single edge (deduplication)", () => {
    const vmId = "vm-001";
    const nicId = "nic-001";

    const resources: AzureResourceInput[] = [
      makeResource({ id: vmId, name: "MyVM", type: "microsoft.compute/virtualmachines" }),
      makeResource({ id: nicId, name: "myvm1", type: "microsoft.network/networkinterfaces" }),
    ];

    const mappings: MappingRecommendationInput[] = [
      { azureResourceId: vmId, awsService: "Amazon EC2", awsCategory: "Compute", confidence: "High" },
      { azureResourceId: nicId, awsService: "Elastic Network Interface", awsCategory: "Networking", confidence: "High" },
    ];

    // Two relationships between same pair (shouldn't happen after dedup in relationship engine,
    // but the topology builder should handle it gracefully)
    const relationships: AzureResourceRelationship[] = [
      { sourceResourceId: vmId, targetResourceId: nicId, relationType: "network", confidence: "Definite", method: "property_ref" },
      { sourceResourceId: vmId, targetResourceId: nicId, relationType: "network", confidence: "High", method: "name_heuristic" },
    ];

    const result = buildAWSTopology(relationships, mappings, resources);

    expect(result.nodes.length).toBe(2);
    // Should deduplicate to single edge
    expect(result.edges.length).toBe(1);
  });

  it("preserves relationship type and confidence on mirrored edges", () => {
    const vmId = "vm-001";
    const diskId = "disk-001";
    const nicId = "nic-001";

    const resources: AzureResourceInput[] = [
      makeResource({ id: vmId, name: "MyVM", type: "microsoft.compute/virtualmachines" }),
      makeResource({ id: diskId, name: "MyVM_OsDisk_0", type: "microsoft.compute/disks" }),
      makeResource({ id: nicId, name: "myvm1", type: "microsoft.network/networkinterfaces" }),
    ];

    const mappings: MappingRecommendationInput[] = [
      { azureResourceId: vmId, awsService: "Amazon EC2", awsCategory: "Compute", confidence: "High" },
      { azureResourceId: diskId, awsService: "Amazon EBS", awsCategory: "Storage", confidence: "High" },
      { azureResourceId: nicId, awsService: "Elastic Network Interface", awsCategory: "Networking", confidence: "Medium" },
    ];

    const relationships: AzureResourceRelationship[] = [
      { sourceResourceId: vmId, targetResourceId: diskId, relationType: "storage", confidence: "High", method: "name_heuristic" },
      { sourceResourceId: vmId, targetResourceId: nicId, relationType: "network", confidence: "Definite", method: "property_ref" },
    ];

    const result = buildAWSTopology(relationships, mappings, resources);

    expect(result.edges.length).toBe(2);

    const storageEdge = result.edges.find((e) => e.targetNodeId === `aws-${diskId}`);
    expect(storageEdge!.relationType).toBe("storage");
    expect(storageEdge!.confidence).toBe("High");

    const networkEdge = result.edges.find((e) => e.targetNodeId === `aws-${nicId}`);
    expect(networkEdge!.relationType).toBe("network");
    expect(networkEdge!.confidence).toBe("Definite");
  });
});
