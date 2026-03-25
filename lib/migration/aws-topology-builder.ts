/**
 * AWS Topology Builder — Pure client-side function module.
 * Generates a mirrored AWS resource topology from Azure relationships
 * and mapping recommendations. NO database dependencies, NO side effects.
 */

import type {
  AzureResourceInput,
  AzureResourceRelationship,
  RelationType,
  ConfidenceLevel,
} from "./relationship-engine";

// ── Types ──────────────────────────────────────────────────────────────────

export interface AWSTopologyNode {
  id: string;
  awsService: string;
  awsCategory: string;
  sourceAzureResourceId: string;
  label: string;
  hasMappingRecommendation: boolean;
}

export interface AWSTopologyEdge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  relationType: RelationType;
  confidence: ConfidenceLevel;
}

export interface AWSTopologyResult {
  nodes: AWSTopologyNode[];
  edges: AWSTopologyEdge[];
}

export interface MappingRecommendationInput {
  azureResourceId: string;
  awsService: string;
  awsCategory: string;
  confidence: string;
}

// ── Relationship type mapping table (Azure → AWS) ──────────────────────────

/**
 * Maps Azure resource type pairs (source→target) to AWS service name overrides.
 * Used for edge labels / tooltips. The node service names come from mapping
 * recommendations, not from this table.
 */
export const AZURE_TO_AWS_RELATIONSHIP_MAP: Record<string, string> = {
  // VM relationships
  "microsoft.compute/virtualmachines->microsoft.network/networkinterfaces": "EC2->ENI",
  "microsoft.compute/virtualmachines->microsoft.compute/disks": "EC2->EBS",
  "microsoft.compute/virtualmachines->microsoft.network/publicipaddresses": "EC2->EIP",
  "microsoft.compute/virtualmachines->microsoft.network/networksecuritygroups": "EC2->Security Group",
  // NIC relationships
  "microsoft.network/networkinterfaces->microsoft.network/publicipaddresses": "ENI->Elastic IP",
  "microsoft.network/networkinterfaces->microsoft.network/networksecuritygroups": "ENI->Security Group",
  "microsoft.network/networkinterfaces->microsoft.network/virtualnetworks/subnets": "ENI->Subnet",

  // VNet relationships
  "microsoft.network/virtualnetworks->microsoft.network/virtualnetworks/subnets": "VPC->Subnet",

  // VPN relationships
  "microsoft.network/vpngateways->microsoft.network/publicipaddresses": "VPN Gateway->EIP",
  "microsoft.network/virtualnetworkgateways->microsoft.network/publicipaddresses": "VPN Gateway->EIP",
  "microsoft.network/connections->microsoft.network/virtualnetworkgateways": "Site-to-Site VPN->VPN Gateway",
  "microsoft.network/connections->microsoft.network/localnetworkgateways": "Site-to-Site VPN->Customer Gateway",

  // Load Balancer relationships
  "microsoft.network/loadbalancers->microsoft.network/loadbalancers/backendaddresspools": "ALB/NLB->Target Group",

  // AKS relationships
  "microsoft.containerservice/managedclusters->microsoft.compute/virtualmachinescalesets": "EKS Cluster->Node Group",
};

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Build a deterministic node ID from the Azure resource ID.
 * Prefixed with "aws-" to distinguish from Azure node IDs.
 */
function awsNodeId(azureResourceId: string): string {
  return `aws-${azureResourceId}`;
}

/**
 * Build a deterministic edge ID from source and target node IDs.
 */
function awsEdgeId(sourceNodeId: string, targetNodeId: string): string {
  return `aws-edge-${sourceNodeId}->${targetNodeId}`;
}

// ── Main function ──────────────────────────────────────────────────────────

/**
 * Build an AWS topology that mirrors Azure relationships using mapping recommendations.
 *
 * Algorithm:
 * 1. For each Azure resource with a mapping recommendation → create an AWS node
 * 2. For each Azure resource that participates in a relationship but has no mapping
 *    → create a "No Mapping" placeholder node
 * 3. For each Azure relationship where both endpoints have AWS nodes → create a
 *    mirrored AWS edge
 *
 * Output is deterministic: identical input → identical output.
 */
export function buildAWSTopology(
  azureRelationships: AzureResourceRelationship[],
  mappingRecommendations: MappingRecommendationInput[],
  azureResources: AzureResourceInput[],
): AWSTopologyResult {
  // Index mapping recommendations by Azure resource ID for O(1) lookup
  const mappingByAzureId = new Map<string, MappingRecommendationInput>();
  for (const rec of mappingRecommendations) {
    mappingByAzureId.set(rec.azureResourceId, rec);
  }

  // Index Azure resources by ID for type lookups
  const azureResourceById = new Map<string, AzureResourceInput>();
  for (const res of azureResources) {
    azureResourceById.set(res.id, res);
  }

  // Collect all Azure resource IDs that participate in relationships
  const participatingIds = new Set<string>();
  for (const rel of azureRelationships) {
    participatingIds.add(rel.sourceResourceId);
    participatingIds.add(rel.targetResourceId);
  }

  // Step 1 & 2: Create AWS nodes
  const nodeMap = new Map<string, AWSTopologyNode>();

  // First pass: create nodes for resources with mapping recommendations
  // Sort by azureResourceId for deterministic output
  const sortedRecommendations = [...mappingRecommendations].sort((a, b) =>
    a.azureResourceId.localeCompare(b.azureResourceId),
  );

  for (const rec of sortedRecommendations) {
    const nodeId = awsNodeId(rec.azureResourceId);
    nodeMap.set(rec.azureResourceId, {
      id: nodeId,
      awsService: rec.awsService,
      awsCategory: rec.awsCategory,
      sourceAzureResourceId: rec.azureResourceId,
      label: rec.awsService,
      hasMappingRecommendation: true,
    });
  }

  // Second pass: create placeholder nodes for participating resources without mappings
  const sortedParticipating = [...participatingIds].sort();
  for (const azureId of sortedParticipating) {
    if (!nodeMap.has(azureId)) {
      const azureResource = azureResourceById.get(azureId);
      const nodeId = awsNodeId(azureId);
      nodeMap.set(azureId, {
        id: nodeId,
        awsService: "No Mapping",
        awsCategory: "unmapped",
        sourceAzureResourceId: azureId,
        label: azureResource ? `${azureResource.name} (No Mapping)` : "No Mapping",
        hasMappingRecommendation: false,
      });
    }
  }

  // Step 3: Create mirrored AWS edges
  const edges: AWSTopologyEdge[] = [];
  const seenEdges = new Set<string>();

  // Sort relationships for deterministic output
  const sortedRelationships = [...azureRelationships].sort((a, b) => {
    const srcCmp = a.sourceResourceId.localeCompare(b.sourceResourceId);
    if (srcCmp !== 0) return srcCmp;
    return a.targetResourceId.localeCompare(b.targetResourceId);
  });

  for (const rel of sortedRelationships) {
    const sourceNode = nodeMap.get(rel.sourceResourceId);
    const targetNode = nodeMap.get(rel.targetResourceId);

    // Only create edge if both endpoints have AWS nodes
    if (sourceNode && targetNode) {
      const edgeId = awsEdgeId(sourceNode.id, targetNode.id);

      // Deduplicate edges (same source→target pair)
      if (!seenEdges.has(edgeId)) {
        seenEdges.add(edgeId);
        edges.push({
          id: edgeId,
          sourceNodeId: sourceNode.id,
          targetNodeId: targetNode.id,
          relationType: rel.relationType,
          confidence: rel.confidence,
        });
      }
    }
  }

  // Collect nodes in deterministic order (sorted by node ID)
  const nodes = [...nodeMap.values()].sort((a, b) => a.id.localeCompare(b.id));

  return { nodes, edges };
}
