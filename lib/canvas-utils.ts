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
