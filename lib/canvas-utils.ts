// eslint-disable-next-line @typescript-eslint/no-require-imports
const dagre = require("@dagrejs/dagre");

export interface CanvasNode {
  id: string;
  type: "azure" | "aws";
  data: {
    label: string;
    category: string;
    count?: number;
    confidence?: string;
    resourceId?: string;
  };
  position: { x: number; y: number };
}

export interface CanvasEdge {
  id: string;
  source: string;
  target: string;
  data: {
    confidence: string;
    azureResourceId: string;
  };
}

export interface AzureResourceWithRecommendation {
  id: string;
  name: string;
  type: string;
  location: string | null;
  recommendations: {
    awsService: string;
    awsCategory: string;
    confidence: string;
    rationale: string;
    migrationNotes: string;
    alternatives: string[];
  }[];
}

/**
 * Build a canvas graph from Azure resources with recommendations.
 *
 * Nodes are sorted by category so related resources cluster together
 * in the Dagre layout. AWS nodes are deduplicated with counts.
 */
export function buildCanvasGraph(resources: AzureResourceWithRecommendation[]): {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
} {
  const nodes: CanvasNode[] = [];
  const edges: CanvasEdge[] = [];

  // Track AWS service deduplication: serviceName -> { category, count }
  const awsServiceCounts = new Map<
    string,
    { category: string; count: number }
  >();

  // Sort resources by category to help Dagre cluster them
  const sorted = [...resources].sort((a, b) => {
    const catA = a.recommendations[0]?.awsCategory ?? "Unknown";
    const catB = b.recommendations[0]?.awsCategory ?? "Unknown";
    return catA.localeCompare(catB);
  });

  // 1. Create Azure nodes and collect AWS service counts
  for (const resource of sorted) {
    const category = resource.recommendations[0]?.awsCategory ?? "Unknown";
    const confidence = resource.recommendations[0]?.confidence ?? "None";

    nodes.push({
      id: `azure-${resource.id}`,
      type: "azure",
      data: {
        label: resource.name,
        category,
        confidence,
        resourceId: resource.id,
      },
      position: { x: 0, y: 0 },
    });

    for (const rec of resource.recommendations) {
      if (!rec.awsService) continue;
      const existing = awsServiceCounts.get(rec.awsService);
      if (existing) {
        existing.count++;
      } else {
        awsServiceCounts.set(rec.awsService, {
          category: rec.awsCategory,
          count: 1,
        });
      }
    }
  }

  // 2. Create deduplicated AWS nodes (sorted by category)
  const sortedServices = [...awsServiceCounts.entries()].sort((a, b) =>
    a[1].category.localeCompare(b[1].category)
  );

  for (const [serviceName, info] of sortedServices) {
    nodes.push({
      id: `aws-${serviceName}`,
      type: "aws",
      data: {
        label: serviceName,
        category: info.category,
        count: info.count,
      },
      position: { x: 0, y: 0 },
    });
  }

  // 3. Create edges
  for (const resource of sorted) {
    for (const rec of resource.recommendations) {
      if (!rec.awsService) continue;
      edges.push({
        id: `edge-${resource.id}-${rec.awsService}`,
        source: `azure-${resource.id}`,
        target: `aws-${rec.awsService}`,
        data: { confidence: rec.confidence, azureResourceId: resource.id },
      });
    }
  }

  // 4. Dagre layout (Left-to-Right)
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: "LR",
    nodesep: 16,    // tighter vertical spacing
    ranksep: 250,   // more space between Azure and AWS columns
    marginx: 30,
    marginy: 30,
  });

  const NODE_W = 220;
  const AZURE_H = 48;
  const AWS_H = 52;

  for (const node of nodes) {
    const h = node.type === "aws" ? AWS_H : AZURE_H;
    g.setNode(node.id, { width: NODE_W, height: h });
  }
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  // Apply computed positions (center-offset to top-left for React Flow)
  for (const node of nodes) {
    const pos = g.node(node.id);
    if (pos) {
      node.position = {
        x: pos.x - NODE_W / 2,
        y: pos.y - (node.type === "aws" ? AWS_H : AZURE_H) / 2,
      };
    }
  }

  return { nodes, edges };
}

// ── Dual Topology Types & Builder ──────────────────────────────────────────

import type {
  AzureResourceInput,
  AzureResourceRelationship,
  RelationType,
  ConfidenceLevel,
} from "./migration/relationship-engine";

import type {
  AWSTopologyResult,
  MappingRecommendationInput,
} from "./migration/aws-topology-builder";

// ── Edge styling constants ─────────────────────────────────────────────────

export const RELATION_EDGE_STYLES: Record<
  RelationType,
  { color: string; strokeDasharray: string; strokeWidth: number }
> = {
  contains:   { color: "#94a3b8", strokeDasharray: "4 4", strokeWidth: 1 },
  network:    { color: "#3b82f6", strokeDasharray: "",    strokeWidth: 1.5 },
  storage:    { color: "#22c55e", strokeDasharray: "",    strokeWidth: 1.5 },
  security:   { color: "#f97316", strokeDasharray: "6 3", strokeWidth: 1.5 },
  gateway:    { color: "#a855f7", strokeDasharray: "",    strokeWidth: 1.5 },
  monitoring: { color: "#06b6d4", strokeDasharray: "4 4", strokeWidth: 1 },
};

export const MAPPING_CONFIDENCE_COLORS: Record<string, string> = {
  High:   "#22c55e",
  Medium: "#eab308",
  Low:    "#f97316",
  None:   "#ef4444",
};

// ── Dual Topology Interfaces ───────────────────────────────────────────────

export interface RGSummaryData {
  resourceCount: number;
  topTypes: { type: string; count: number }[];
  internalRelCount: number;
  mappingCount: number;
}

export interface DualTopologyNode {
  id: string;
  type: "azure" | "aws" | "resource-group" | "no-mapping" | "rg-summary";
  data: {
    label: string;
    category: string;
    resourceId?: string;
    resourceGroup?: string | null;
    resourceType?: string;
    location?: string | null;
    awsService?: string;
    /** Original Azure resource name for AWS nodes */
    azureResourceName?: string;
    confidence?: string;
    hasMappingRecommendation?: boolean;
    /** true when search matches this node */
    highlighted?: boolean;
    /** true when search is active but this node doesn't match */
    dimmed?: boolean;
    /** number of children for collapsed RG nodes */
    childCount?: number;
    /** summary stats for rg-summary nodes */
    rgSummary?: RGSummaryData;
    /** true when this RG is currently expanded */
    isExpanded?: boolean;
  };
  position: { x: number; y: number };
}

export interface DualTopologyEdge {
  id: string;
  source: string;
  target: string;
  type: "relationship" | "mapping" | "aggregated";
  data: {
    relationType?: RelationType;
    confidence?: string;
    method?: string;
    color: string;
    strokeDasharray: string;
    strokeWidth: number;
    animated?: boolean;
    /** number of underlying edges for aggregated cross-RG edges */
    aggregatedCount?: number;
  };
}

export interface DualTopologyFilters {
  resourceGroups?: string[];
  relationTypes?: RelationType[];
  confidenceLevels?: ConfidenceLevel[];
  searchTerm?: string;
  viewMode?: "dual" | "azure-only" | "aws-only";
  /** RG names currently expanded — when defined, enables progressive disclosure mode */
  expandedRGs?: string[];
}

export interface DualTopologyInput {
  azureResources: AzureResourceInput[];
  azureRelationships: AzureResourceRelationship[];
  awsTopology: AWSTopologyResult;
  mappingRecommendations: MappingRecommendationInput[];
  filters?: DualTopologyFilters;
}

export interface DualTopologyGraph {
  nodes: DualTopologyNode[];
  edges: DualTopologyEdge[];
  resourceGroupBounds: Map<string, { x: number; y: number; width: number; height: number }>;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function matchesSearch(label: string, term: string): boolean {
  return label.toLowerCase().includes(term.toLowerCase());
}

/**
 * Compute bounding boxes for resource groups from positioned Azure nodes.
 */
function computeResourceGroupBounds(
  nodes: DualTopologyNode[],
): Map<string, { x: number; y: number; width: number; height: number }> {
  const bounds = new Map<string, { minX: number; minY: number; maxX: number; maxY: number }>();
  const NODE_W = 220;
  const NODE_H = 48;
  const PADDING = 20;

  for (const node of nodes) {
    if (node.type !== "azure" || !node.data.resourceGroup) continue;
    const rg = node.data.resourceGroup;
    const existing = bounds.get(rg);
    const right = node.position.x + NODE_W;
    const bottom = node.position.y + NODE_H;

    if (existing) {
      existing.minX = Math.min(existing.minX, node.position.x);
      existing.minY = Math.min(existing.minY, node.position.y);
      existing.maxX = Math.max(existing.maxX, right);
      existing.maxY = Math.max(existing.maxY, bottom);
    } else {
      bounds.set(rg, { minX: node.position.x, minY: node.position.y, maxX: right, maxY: bottom });
    }
  }

  const result = new Map<string, { x: number; y: number; width: number; height: number }>();
  for (const [rg, b] of bounds) {
    result.set(rg, {
      x: b.minX - PADDING,
      y: b.minY - PADDING,
      width: b.maxX - b.minX + 2 * PADDING,
      height: b.maxY - b.minY + 2 * PADDING,
    });
  }
  return result;
}

// ── Main function ──────────────────────────────────────────────────────────

/**
 * Build a dual-topology graph for the migration canvas.
 *
 * Creates Azure nodes (rank 0, left), AWS nodes (rank 2, right),
 * relationship edges on both sides, and mapping edges in the center.
 * Applies filters and search highlighting.
 */
export function buildDualTopologyGraph(input: DualTopologyInput): DualTopologyGraph {
  // Progressive disclosure mode: when expandedRGs is defined (even empty = all collapsed)
  if (input.filters?.expandedRGs !== undefined) {
    return buildProgressiveGraph(input);
  }

  const {
    azureResources,
    azureRelationships,
    awsTopology,
    mappingRecommendations,
    filters,
  } = input;

  const viewMode = filters?.viewMode ?? "dual";
  const searchTerm = filters?.searchTerm?.trim() ?? "";
  const activeRGs = filters?.resourceGroups;
  const activeRelTypes = filters?.relationTypes;
  const activeConfLevels = filters?.confidenceLevels;

  // Index mapping recommendations by Azure resource ID
  const mappingByAzureId = new Map<string, MappingRecommendationInput>();
  for (const rec of mappingRecommendations) {
    mappingByAzureId.set(rec.azureResourceId, rec);
  }

  // Index AWS nodes by source Azure resource ID
  const awsNodeByAzureId = new Map<string, (typeof awsTopology.nodes)[number]>();
  for (const node of awsTopology.nodes) {
    awsNodeByAzureId.set(node.sourceAzureResourceId, node);
  }

  const allNodes: DualTopologyNode[] = [];
  const allEdges: DualTopologyEdge[] = [];

  // ── 1. Create Azure resource nodes ───────────────────────────────────

  // Sort for deterministic output
  const sortedAzure = [...azureResources].sort((a, b) => a.id.localeCompare(b.id));

  const visibleAzureIds = new Set<string>();

  if (viewMode !== "aws-only") {
    for (const res of sortedAzure) {
      // Filter by resource group
      if (activeRGs && activeRGs.length > 0 && res.resourceGroup) {
        if (!activeRGs.includes(res.resourceGroup)) continue;
      }
      if (activeRGs && activeRGs.length > 0 && !res.resourceGroup) continue;

      visibleAzureIds.add(res.id);

      allNodes.push({
        id: `azure-${res.id}`,
        type: "azure",
        data: {
          label: res.name,
          category: res.type,
          resourceId: res.id,
          resourceGroup: res.resourceGroup,
          resourceType: res.type,
          location: res.location,
        },
        position: { x: 0, y: 0 },
      });
    }
  }

  // ── 2. Create AWS resource nodes ─────────────────────────────────────

  const visibleAwsNodeIds = new Set<string>();

  if (viewMode !== "azure-only") {
    for (const awsNode of awsTopology.nodes) {
      // If RG filter is active, only show AWS nodes whose source Azure resource is visible
      if (activeRGs && activeRGs.length > 0) {
        const sourceRes = azureResources.find((r) => r.id === awsNode.sourceAzureResourceId);
        if (sourceRes && sourceRes.resourceGroup && !activeRGs.includes(sourceRes.resourceGroup)) continue;
        if (sourceRes && !sourceRes.resourceGroup) continue;
      }

      visibleAwsNodeIds.add(awsNode.id);

      const mapping = mappingByAzureId.get(awsNode.sourceAzureResourceId);

      allNodes.push({
        id: awsNode.id,
        type: awsNode.hasMappingRecommendation ? "aws" : "no-mapping",
        data: {
          label: awsNode.label,
          category: awsNode.awsCategory,
          resourceId: awsNode.sourceAzureResourceId,
          awsService: awsNode.awsService,
          confidence: mapping?.confidence ?? "None",
          hasMappingRecommendation: awsNode.hasMappingRecommendation,
        },
        position: { x: 0, y: 0 },
      });
    }
  }

  // ── 3. Create Azure relationship edges ───────────────────────────────

  if (viewMode !== "aws-only") {
    const sortedRels = [...azureRelationships].sort((a, b) => {
      const cmp = a.sourceResourceId.localeCompare(b.sourceResourceId);
      return cmp !== 0 ? cmp : a.targetResourceId.localeCompare(b.targetResourceId);
    });

    for (const rel of sortedRels) {
      if (!visibleAzureIds.has(rel.sourceResourceId) || !visibleAzureIds.has(rel.targetResourceId)) continue;
      if (activeRelTypes && activeRelTypes.length > 0 && !activeRelTypes.includes(rel.relationType)) continue;
      if (activeConfLevels && activeConfLevels.length > 0 && !activeConfLevels.includes(rel.confidence)) continue;

      const style = RELATION_EDGE_STYLES[rel.relationType];
      allEdges.push({
        id: `azure-rel-${rel.sourceResourceId}-${rel.targetResourceId}`,
        source: `azure-${rel.sourceResourceId}`,
        target: `azure-${rel.targetResourceId}`,
        type: "relationship",
        data: {
          relationType: rel.relationType,
          confidence: rel.confidence,
          method: rel.method,
          color: style.color,
          strokeDasharray: style.strokeDasharray,
          strokeWidth: style.strokeWidth,
        },
      });
    }
  }

  // ── 4. Create AWS relationship edges (mirrored) ──────────────────────

  if (viewMode !== "azure-only") {
    for (const awsEdge of awsTopology.edges) {
      if (!visibleAwsNodeIds.has(awsEdge.sourceNodeId) || !visibleAwsNodeIds.has(awsEdge.targetNodeId)) continue;
      if (activeRelTypes && activeRelTypes.length > 0 && !activeRelTypes.includes(awsEdge.relationType)) continue;
      if (activeConfLevels && activeConfLevels.length > 0 && !activeConfLevels.includes(awsEdge.confidence)) continue;

      const style = RELATION_EDGE_STYLES[awsEdge.relationType];
      allEdges.push({
        id: `aws-rel-${awsEdge.id}`,
        source: awsEdge.sourceNodeId,
        target: awsEdge.targetNodeId,
        type: "relationship",
        data: {
          relationType: awsEdge.relationType,
          confidence: awsEdge.confidence,
          color: style.color,
          strokeDasharray: style.strokeDasharray,
          strokeWidth: style.strokeWidth,
        },
      });
    }
  }

  // ── 5. Create mapping edges (Azure → AWS) ────────────────────────────

  if (viewMode === "dual") {
    for (const rec of mappingRecommendations) {
      if (!visibleAzureIds.has(rec.azureResourceId)) continue;
      const awsNode = awsNodeByAzureId.get(rec.azureResourceId);
      if (!awsNode || !visibleAwsNodeIds.has(awsNode.id)) continue;

      const color = MAPPING_CONFIDENCE_COLORS[rec.confidence] ?? MAPPING_CONFIDENCE_COLORS.None;
      allEdges.push({
        id: `mapping-${rec.azureResourceId}`,
        source: `azure-${rec.azureResourceId}`,
        target: awsNode.id,
        type: "mapping",
        data: {
          confidence: rec.confidence,
          color,
          strokeDasharray: "6 3",
          strokeWidth: 1.5,
          animated: true,
        },
      });
    }
  }

  // ── 6. Dagre layout (separate graphs per column, then offset) ──────

  const NODE_W = 220;
  const NODE_H = 48;
  const COLUMN_GAP = 300;

  const azureNodeSet = new Set(
    allNodes.filter((n) => n.type === "azure" || n.type === "resource-group").map((n) => n.id),
  );
  const awsNodeSet = new Set(
    allNodes.filter((n) => n.type === "aws" || n.type === "no-mapping").map((n) => n.id),
  );

  // Layout Azure column
  const gAzure = new dagre.graphlib.Graph();
  gAzure.setDefaultEdgeLabel(() => ({}));
  gAzure.setGraph({ rankdir: "TB", nodesep: 20, ranksep: 40, marginx: 30, marginy: 30 });

  for (const node of allNodes) {
    if (azureNodeSet.has(node.id)) {
      gAzure.setNode(node.id, { width: NODE_W, height: NODE_H });
    }
  }
  for (const edge of allEdges) {
    if (azureNodeSet.has(edge.source) && azureNodeSet.has(edge.target)) {
      gAzure.setEdge(edge.source, edge.target);
    }
  }
  dagre.layout(gAzure);

  // Layout AWS column
  const gAws = new dagre.graphlib.Graph();
  gAws.setDefaultEdgeLabel(() => ({}));
  gAws.setGraph({ rankdir: "TB", nodesep: 20, ranksep: 40, marginx: 30, marginy: 30 });

  for (const node of allNodes) {
    if (awsNodeSet.has(node.id)) {
      gAws.setNode(node.id, { width: NODE_W, height: NODE_H });
    }
  }
  for (const edge of allEdges) {
    if (awsNodeSet.has(edge.source) && awsNodeSet.has(edge.target)) {
      gAws.setEdge(edge.source, edge.target);
    }
  }
  dagre.layout(gAws);

  // Compute Azure column width to determine AWS offset
  let azureMaxX = 0;
  for (const node of allNodes) {
    if (!azureNodeSet.has(node.id)) continue;
    const pos = gAzure.node(node.id);
    if (pos) {
      const right = pos.x + NODE_W / 2;
      if (right > azureMaxX) azureMaxX = right;
    }
  }

  const awsOffsetX = azureMaxX + COLUMN_GAP;

  // Apply Azure positions
  for (const node of allNodes) {
    if (!azureNodeSet.has(node.id)) continue;
    const pos = gAzure.node(node.id);
    if (pos) {
      node.position = { x: pos.x - NODE_W / 2, y: pos.y - NODE_H / 2 };
    }
  }

  // Apply AWS positions with offset
  for (const node of allNodes) {
    if (!awsNodeSet.has(node.id)) continue;
    const pos = gAws.node(node.id);
    if (pos) {
      node.position = { x: awsOffsetX + pos.x - NODE_W / 2, y: pos.y - NODE_H / 2 };
    }
  }

  // ── 7. Compute resource group bounding boxes ─────────────────────────

  const resourceGroupBounds = computeResourceGroupBounds(allNodes);

  // ── 8. Apply search highlighting ─────────────────────────────────────

  if (searchTerm) {
    for (const node of allNodes) {
      const matches = matchesSearch(node.data.label, searchTerm);
      node.data.highlighted = matches;
      node.data.dimmed = !matches;
    }
  }

  return { nodes: allNodes, edges: allEdges, resourceGroupBounds };
}

// ── Progressive Disclosure Helpers ──────────────────────────────────────────

/**
 * Compute summary stats for a resource group.
 */
function buildRGSummaryData(
  resources: AzureResourceInput[],
  relationships: AzureResourceRelationship[],
  mappings: Map<string, MappingRecommendationInput>,
): RGSummaryData {
  // Count resource types
  const typeCounts = new Map<string, number>();
  const resourceIds = new Set(resources.map((r) => r.id));

  for (const r of resources) {
    // Extract short type name (e.g., "Microsoft.Compute/virtualMachines" → "VMs")
    const shortType = getShortTypeName(r.type);
    typeCounts.set(shortType, (typeCounts.get(shortType) ?? 0) + 1);
  }

  // Top 3 types sorted by count desc
  const topTypes = [...typeCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([type, count]) => ({ type, count }));

  // Count internal relationships (both endpoints in this RG)
  let internalRelCount = 0;
  for (const rel of relationships) {
    if (resourceIds.has(rel.sourceResourceId) && resourceIds.has(rel.targetResourceId)) {
      internalRelCount++;
    }
  }

  // Count resources with mapping recommendations
  let mappingCount = 0;
  for (const r of resources) {
    if (mappings.has(r.id)) mappingCount++;
  }

  return { resourceCount: resources.length, topTypes, internalRelCount, mappingCount };
}

/**
 * Convert Azure resource type to a short display name.
 */
function getShortTypeName(azureType: string): string {
  const typeMap: Record<string, string> = {
    "microsoft.compute/virtualmachines": "VMs",
    "microsoft.network/networkinterfaces": "NICs",
    "microsoft.network/networksecuritygroups": "NSGs",
    "microsoft.network/publicipaddresses": "Public IPs",
    "microsoft.compute/disks": "Disks",
    "microsoft.network/virtualnetworks": "VNets",
    "microsoft.devtestlab/schedules": "Schedules",
    "microsoft.network/connections": "Connections",
    "microsoft.network/localnetworkgateways": "LNG",
    "microsoft.network/virtualnetworkgateways": "VPN GW",
    "microsoft.containerservice/managedclusters": "AKS",
    "microsoft.network/loadbalancers": "LBs",
    "microsoft.network/applicationgateways": "App GW",
    "microsoft.network/bastionhosts": "Bastion",
    "microsoft.storage/storageaccounts": "Storage",
    "microsoft.web/sites": "Web Apps",
    "microsoft.sql/servers": "SQL",
    "microsoft.keyvault/vaults": "Key Vaults",
    "microsoft.containerregistry/registries": "ACR",
    "microsoft.recoveryservices/vaults": "Recovery",
    "microsoft.network/networkwatchers": "Watchers",
  };
  return typeMap[azureType.toLowerCase()] ?? azureType.split("/").pop() ?? azureType;
}

/**
 * Build aggregated cross-RG edges.
 * Returns one edge per RG pair with a count of underlying relationships.
 */
function aggregateCrossRGEdges(
  relationships: AzureResourceRelationship[],
  resourceRGMap: Map<string, string>,
  collapsedRGs: Set<string>,
  expandedRGs: Set<string>,
  activeRelTypes: RelationType[] | undefined,
  activeConfLevels: ConfidenceLevel[] | undefined,
): DualTopologyEdge[] {
  // Count edges between RG pairs (or RG → individual node)
  const pairCounts = new Map<string, number>();

  for (const rel of relationships) {
    if (activeRelTypes && activeRelTypes.length > 0 && !activeRelTypes.includes(rel.relationType)) continue;
    if (activeConfLevels && activeConfLevels.length > 0 && !activeConfLevels.includes(rel.confidence)) continue;

    const sourceRG = resourceRGMap.get(rel.sourceResourceId);
    const targetRG = resourceRGMap.get(rel.targetResourceId);
    if (!sourceRG || !targetRG) continue;

    // Skip if both in same collapsed RG (internal — counted in summary)
    if (sourceRG === targetRG && collapsedRGs.has(sourceRG)) continue;

    // Skip if both in same expanded RG (handled as individual edges)
    if (sourceRG === targetRG && expandedRGs.has(sourceRG)) continue;

    // Determine edge endpoints
    const sourceNode = collapsedRGs.has(sourceRG)
      ? `rg-summary-${sourceRG}`
      : `azure-${rel.sourceResourceId}`;
    const targetNode = collapsedRGs.has(targetRG)
      ? `rg-summary-${targetRG}`
      : `azure-${rel.targetResourceId}`;

    // Create a deterministic pair key (sorted to avoid duplicates A→B vs B→A)
    const pairKey = sourceNode < targetNode ? `${sourceNode}||${targetNode}` : `${targetNode}||${sourceNode}`;
    pairCounts.set(pairKey, (pairCounts.get(pairKey) ?? 0) + 1);
  }

  // Convert to edges
  const edges: DualTopologyEdge[] = [];
  const sortedPairs = [...pairCounts.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  for (const [pairKey, count] of sortedPairs) {
    const [source, target] = pairKey.split("||");
    edges.push({
      id: `agg-${pairKey}`,
      source,
      target,
      type: "aggregated",
      data: {
        color: "#64748b",
        strokeDasharray: "6 4",
        strokeWidth: Math.min(1.5 + count * 0.3, 4),
        aggregatedCount: count,
      },
    });
  }

  return edges;
}

// ── Progressive Disclosure Graph Builder ─────────────────────────────────────

/**
 * Build a progressive disclosure graph.
 * Collapsed RGs render as summary cards; expanded RGs render individual nodes.
 */
function buildProgressiveGraph(input: DualTopologyInput): DualTopologyGraph {
  const {
    azureResources,
    azureRelationships,
    awsTopology,
    mappingRecommendations,
    filters,
  } = input;

  const viewMode = filters?.viewMode ?? "dual";
  const searchTerm = filters?.searchTerm?.trim() ?? "";
  const activeRGs = filters?.resourceGroups;
  const activeRelTypes = filters?.relationTypes;
  const activeConfLevels = filters?.confidenceLevels;
  const expandedRGNames = new Set(filters?.expandedRGs ?? []);

  // Index mapping recommendations
  const mappingByAzureId = new Map<string, MappingRecommendationInput>();
  for (const rec of mappingRecommendations) {
    mappingByAzureId.set(rec.azureResourceId, rec);
  }

  // Index AWS nodes by source Azure resource ID
  const awsNodeByAzureId = new Map<string, (typeof awsTopology.nodes)[number]>();
  for (const node of awsTopology.nodes) {
    awsNodeByAzureId.set(node.sourceAzureResourceId, node);
  }

  // ── 1. Group resources by RG ──────────────────────────────────────────

  const rgGroups = new Map<string, AzureResourceInput[]>();
  const noRGResources: AzureResourceInput[] = [];

  for (const res of azureResources) {
    // Apply RG filter
    if (activeRGs && activeRGs.length > 0) {
      if (res.resourceGroup && !activeRGs.includes(res.resourceGroup)) continue;
      if (!res.resourceGroup) continue;
    }

    if (res.resourceGroup) {
      const list = rgGroups.get(res.resourceGroup) ?? [];
      list.push(res);
      rgGroups.set(res.resourceGroup, list);
    } else {
      noRGResources.push(res);
    }
  }

  // Build resource→RG map for edge aggregation
  const resourceRGMap = new Map<string, string>();
  for (const [rg, resources] of rgGroups) {
    for (const r of resources) {
      resourceRGMap.set(r.id, rg);
    }
  }

  // Determine which RGs are collapsed vs expanded
  const collapsedRGs = new Set<string>();
  const actualExpandedRGs = new Set<string>();
  for (const rg of rgGroups.keys()) {
    if (expandedRGNames.has(rg)) {
      actualExpandedRGs.add(rg);
    } else {
      collapsedRGs.add(rg);
    }
  }

  const allNodes: DualTopologyNode[] = [];
  const allEdges: DualTopologyEdge[] = [];
  const visibleAzureIds = new Set<string>();

  // ── 2. Create RG summary nodes for collapsed RGs ──────────────────────
  //    Shown in ALL modes (Azure, AWS, Dual) for progressive disclosure.

  const azureNodeSet = new Set<string>();
  const sortedRGs = [...collapsedRGs].sort();

  for (const rg of sortedRGs) {
    const resources = rgGroups.get(rg) ?? [];
    const summary = buildRGSummaryData(resources, azureRelationships, mappingByAzureId);

    const nodeId = `rg-summary-${rg}`;
    allNodes.push({
      id: nodeId,
      type: "rg-summary",
      data: {
        label: rg,
        category: "resource-group",
        childCount: resources.length,
        rgSummary: summary,
        isExpanded: false,
      },
      position: { x: 0, y: 0 },
    });
    azureNodeSet.add(nodeId);
  }

  // ── 3. Create individual Azure nodes for expanded RGs ─────────────
  //    Only in Azure/Dual modes (not AWS-only — AWS mode shows AWS hierarchy instead).

  if (viewMode !== "aws-only") {
    for (const rg of actualExpandedRGs) {
      const resources = rgGroups.get(rg) ?? [];
      const sortedResources = [...resources].sort((a, b) => a.id.localeCompare(b.id));

      for (const res of sortedResources) {
        visibleAzureIds.add(res.id);
        const nodeId = `azure-${res.id}`;
        allNodes.push({
          id: nodeId,
          type: "azure",
          data: {
            label: res.name,
            category: res.type,
            resourceId: res.id,
            resourceGroup: res.resourceGroup,
            resourceType: res.type,
            location: res.location,
          },
          position: { x: 0, y: 0 },
        });
        azureNodeSet.add(nodeId);
      }
    }

    // ── 3b. Create nodes for resources without RG ───────────────────

    for (const res of noRGResources.sort((a, b) => a.id.localeCompare(b.id))) {
      visibleAzureIds.add(res.id);
      const nodeId = `azure-${res.id}`;
      allNodes.push({
        id: nodeId,
        type: "azure",
        data: {
          label: res.name,
          category: res.type,
          resourceId: res.id,
          resourceGroup: res.resourceGroup,
          resourceType: res.type,
          location: res.location,
        },
        position: { x: 0, y: 0 },
      });
      azureNodeSet.add(nodeId);
    }
  }

  // ── 4. Create AWS nodes ─────────────────────────────────────────────
  //    Progressive disclosure applies: only show AWS nodes for expanded RGs.
  //    Azure resource name is looked up for display as subtitle on each node.

  const visibleAwsNodeIds = new Set<string>();
  const awsNodeSet = new Set<string>();

  // Build name lookup: azureResourceId → resource name
  const azureNameById = new Map<string, string>();
  for (const res of azureResources) {
    azureNameById.set(res.id, res.name);
  }

  if (viewMode !== "azure-only") {
    for (const awsNode of awsTopology.nodes) {
      // Skip unmapped placeholder nodes — they show as "Unmapped/Unknown" noise
      if (!awsNode.hasMappingRecommendation) continue;
      // Skip nodes with empty/invalid service names (bad mapping data)
      if (!awsNode.awsService || awsNode.awsService === "No Mapping") continue;

      const sourceRG = resourceRGMap.get(awsNode.sourceAzureResourceId);
      // Progressive disclosure: only show AWS nodes for EXPANDED RGs (all modes)
      if (sourceRG && collapsedRGs.has(sourceRG)) continue;
      // Apply RG filter
      if (activeRGs && activeRGs.length > 0) {
        if (sourceRG && !activeRGs.includes(sourceRG)) continue;
      }

      visibleAwsNodeIds.add(awsNode.id);
      const mapping = mappingByAzureId.get(awsNode.sourceAzureResourceId);
      const azureName = azureNameById.get(awsNode.sourceAzureResourceId);

      const nodeId = awsNode.id;
      allNodes.push({
        id: nodeId,
        type: "aws",
        data: {
          label: awsNode.label,
          category: awsNode.awsCategory,
          resourceId: awsNode.sourceAzureResourceId,
          awsService: awsNode.awsService,
          azureResourceName: azureName,
          confidence: mapping?.confidence ?? "None",
          hasMappingRecommendation: true,
        },
        position: { x: 0, y: 0 },
      });
      awsNodeSet.add(nodeId);
    }
  }

  // ── 5. Create edges ─────────────────────────────────────────────────

  // Individual relationship edges within expanded RGs (Azure/Dual only)
  if (viewMode !== "aws-only") {
    const sortedRels = [...azureRelationships].sort((a, b) => {
      const cmp = a.sourceResourceId.localeCompare(b.sourceResourceId);
      return cmp !== 0 ? cmp : a.targetResourceId.localeCompare(b.targetResourceId);
    });

    for (const rel of sortedRels) {
      if (!visibleAzureIds.has(rel.sourceResourceId) || !visibleAzureIds.has(rel.targetResourceId)) continue;
      if (activeRelTypes && activeRelTypes.length > 0 && !activeRelTypes.includes(rel.relationType)) continue;
      if (activeConfLevels && activeConfLevels.length > 0 && !activeConfLevels.includes(rel.confidence)) continue;

      const style = RELATION_EDGE_STYLES[rel.relationType];
      allEdges.push({
        id: `azure-rel-${rel.sourceResourceId}-${rel.targetResourceId}`,
        source: `azure-${rel.sourceResourceId}`,
        target: `azure-${rel.targetResourceId}`,
        type: "relationship",
        data: {
          relationType: rel.relationType,
          confidence: rel.confidence,
          method: rel.method,
          color: style.color,
          strokeDasharray: style.strokeDasharray,
          strokeWidth: style.strokeWidth,
        },
      });
    }
  }

  // Aggregated cross-RG edges (all modes — RG summaries are shown in every mode)
  const aggEdges = aggregateCrossRGEdges(
    azureRelationships, resourceRGMap, collapsedRGs, actualExpandedRGs,
    activeRelTypes, activeConfLevels,
  );
  allEdges.push(...aggEdges);

  // AWS relationship edges (mirrored, only for expanded)
  if (viewMode !== "azure-only") {
    for (const awsEdge of awsTopology.edges) {
      if (!visibleAwsNodeIds.has(awsEdge.sourceNodeId) || !visibleAwsNodeIds.has(awsEdge.targetNodeId)) continue;
      if (activeRelTypes && activeRelTypes.length > 0 && !activeRelTypes.includes(awsEdge.relationType)) continue;
      if (activeConfLevels && activeConfLevels.length > 0 && !activeConfLevels.includes(awsEdge.confidence)) continue;

      const style = RELATION_EDGE_STYLES[awsEdge.relationType];
      allEdges.push({
        id: `aws-rel-${awsEdge.id}`,
        source: awsEdge.sourceNodeId,
        target: awsEdge.targetNodeId,
        type: "relationship",
        data: {
          relationType: awsEdge.relationType,
          confidence: awsEdge.confidence,
          color: style.color,
          strokeDasharray: style.strokeDasharray,
          strokeWidth: style.strokeWidth,
        },
      });
    }
  }

  // Mapping edges (only for expanded RG resources)
  if (viewMode === "dual") {
    for (const rec of mappingRecommendations) {
      if (!visibleAzureIds.has(rec.azureResourceId)) continue;
      const awsNode = awsNodeByAzureId.get(rec.azureResourceId);
      if (!awsNode || !visibleAwsNodeIds.has(awsNode.id)) continue;

      const color = MAPPING_CONFIDENCE_COLORS[rec.confidence] ?? MAPPING_CONFIDENCE_COLORS.None;
      allEdges.push({
        id: `mapping-${rec.azureResourceId}`,
        source: `azure-${rec.azureResourceId}`,
        target: awsNode.id,
        type: "mapping",
        data: {
          confidence: rec.confidence,
          color,
          strokeDasharray: "6 3",
          strokeWidth: 1.5,
          animated: true,
        },
      });
    }
  }

  // ── 6. Grid-first layout (Dagre spreads unconnected nodes in a single row) ──

  const NODE_W = 220;
  const NODE_H = 48;
  const RG_SUMMARY_W = 260;
  const RG_SUMMARY_H = 100;
  const COLUMN_GAP = 300;
  const SECTION_GAP = 48;
  const GRID_GAP_X = 28;
  const GRID_GAP_Y = 20;
  const MARGIN = 30;

  /** Arrange nodes in a compact grid with configurable columns */
  function arrangeGrid(
    nodes: DualTopologyNode[],
    w: number, h: number,
    opts?: { maxCols?: number; startX?: number; startY?: number },
  ): { maxX: number; maxY: number } {
    const maxCols = opts?.maxCols ?? 3;
    const startX = opts?.startX ?? MARGIN;
    const startY = opts?.startY ?? MARGIN;
    const cols = Math.min(maxCols, nodes.length);
    let maxX = 0;
    let maxY = 0;
    for (let i = 0; i < nodes.length; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (w + GRID_GAP_X);
      const y = startY + row * (h + GRID_GAP_Y);
      nodes[i].position = { x, y };
      if (x + w > maxX) maxX = x + w;
      if (y + h > maxY) maxY = y + h;
    }
    return { maxX, maxY };
  }

  // azureNodeSet and awsNodeSet are built incrementally in steps 2-4 above.

  // Split Azure nodes into collapsed summaries vs expanded individuals
  const summaryNodes = allNodes.filter((n) => n.type === "rg-summary");
  const expandedAzureNodes = allNodes.filter((n) => n.type === "azure" && azureNodeSet.has(n.id));
  const hasExpandedNodes = expandedAzureNodes.length > 0;
  const hasSummaryNodes = summaryNodes.length > 0;

  if (hasExpandedNodes && hasSummaryNodes) {
    // ── Mixed mode: expanded nodes grid + collapsed summaries below ──

    // Section A: expanded individual nodes in a 3-column grid
    const expandedBounds = arrangeGrid(expandedAzureNodes, NODE_W, NODE_H, {
      maxCols: 3, startX: MARGIN, startY: MARGIN,
    });

    // Section B: collapsed RG summaries in a 2-column grid below
    arrangeGrid(summaryNodes, RG_SUMMARY_W, RG_SUMMARY_H, {
      maxCols: 2, startX: MARGIN, startY: expandedBounds.maxY + SECTION_GAP,
    });

  } else if (hasSummaryNodes) {
    // ── Pure overview: summary cards in a 3-column grid ──
    arrangeGrid(summaryNodes, RG_SUMMARY_W, RG_SUMMARY_H, { maxCols: 3 });

  } else if (hasExpandedNodes) {
    // ── Pure expanded: individual nodes in a 3-column grid ──
    arrangeGrid(expandedAzureNodes, NODE_W, NODE_H, { maxCols: 3 });
  }

  // ── AWS column: hierarchical Dagre LR layout (VPC → EC2 → EBS/ENI/SG) ──
  if (awsNodeSet.size > 0) {
    const awsNodes = allNodes.filter((n) => awsNodeSet.has(n.id));

    // AWS column starts to the right of whatever Azure/summary nodes exist
    let azureMaxX = 0;
    for (const node of allNodes) {
      if (!azureNodeSet.has(node.id)) continue;
      const w = node.type === "rg-summary" ? RG_SUMMARY_W : NODE_W;
      const right = node.position.x + w;
      if (right > azureMaxX) azureMaxX = right;
    }
    const awsBaseX = azureMaxX > 0 ? azureMaxX + COLUMN_GAP : MARGIN;

    // Collect AWS-side edges for hierarchy
    const awsEdges: Array<{ source: string; target: string }> = [];
    const connectedIds = new Set<string>();
    for (const edge of allEdges) {
      if (awsNodeSet.has(edge.source) && awsNodeSet.has(edge.target)) {
        awsEdges.push({ source: edge.source, target: edge.target });
        connectedIds.add(edge.source);
        connectedIds.add(edge.target);
      }
    }

    const connectedAwsNodes = awsNodes.filter((n) => connectedIds.has(n.id));
    const standaloneAwsNodes = awsNodes.filter((n) => !connectedIds.has(n.id));

    let awsMaxY = 0;

    if (connectedAwsNodes.length > 0) {
      // Dagre LR → hierarchy: VPC(rank0) → EC2(rank1) → EBS/ENI/SG(rank2)
      const gAws = new dagre.graphlib.Graph();
      gAws.setDefaultEdgeLabel(() => ({}));
      gAws.setGraph({ rankdir: "LR", nodesep: 14, ranksep: 60, marginx: MARGIN, marginy: MARGIN });

      for (const node of connectedAwsNodes) {
        gAws.setNode(node.id, { width: NODE_W, height: NODE_H });
      }
      for (const e of awsEdges) {
        gAws.setEdge(e.source, e.target);
      }
      dagre.layout(gAws);

      for (const node of connectedAwsNodes) {
        const pos = gAws.node(node.id);
        if (pos) {
          node.position = { x: awsBaseX + pos.x - NODE_W / 2, y: pos.y - NODE_H / 2 };
          const bottom = pos.y + NODE_H / 2;
          if (bottom > awsMaxY) awsMaxY = bottom;
        }
      }
    }

    // Standalone AWS nodes (no relationships) go in a grid below the hierarchy
    if (standaloneAwsNodes.length > 0) {
      arrangeGrid(standaloneAwsNodes, NODE_W, NODE_H, {
        maxCols: 3,
        startX: awsBaseX + MARGIN,
        startY: connectedAwsNodes.length > 0 ? awsMaxY + SECTION_GAP : MARGIN,
      });
    }
  }

  // ── 7. Search highlighting ──────────────────────────────────────────

  if (searchTerm) {
    // For RG summary nodes, highlight if any child matches
    const rgChildMatches = new Map<string, number>();
    for (const [rg, resources] of rgGroups) {
      if (!collapsedRGs.has(rg)) continue;
      let matchCount = 0;
      for (const r of resources) {
        if (matchesSearch(r.name, searchTerm) || matchesSearch(r.type, searchTerm)) {
          matchCount++;
        }
      }
      rgChildMatches.set(rg, matchCount);
    }

    for (const node of allNodes) {
      if (node.type === "rg-summary") {
        const matchCount = rgChildMatches.get(node.data.label) ?? 0;
        const labelMatches = matchesSearch(node.data.label, searchTerm);
        node.data.highlighted = matchCount > 0 || labelMatches;
        node.data.dimmed = matchCount === 0 && !labelMatches;
      } else {
        const matches = matchesSearch(node.data.label, searchTerm);
        node.data.highlighted = matches;
        node.data.dimmed = !matches;
      }
    }
  }

  const resourceGroupBounds = computeResourceGroupBounds(allNodes);
  return { nodes: allNodes, edges: allEdges, resourceGroupBounds };
}
