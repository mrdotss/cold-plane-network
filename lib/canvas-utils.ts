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

export function buildCanvasGraph(resources: AzureResourceWithRecommendation[]): {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
} {
  const nodes: CanvasNode[] = [];
  const edges: CanvasEdge[] = [];

  // Track AWS service deduplication: serviceName -> { category, count }
  const awsServiceCounts = new Map<string, { category: string; count: number }>();

  // 1. Create Azure nodes and collect AWS service counts
  for (const resource of resources) {
    const category = resource.recommendations[0]?.awsCategory ?? "Unknown";
    nodes.push({
      id: `azure-${resource.id}`,
      type: "azure",
      data: {
        label: resource.name,
        category,
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
        awsServiceCounts.set(rec.awsService, { category: rec.awsCategory, count: 1 });
      }
    }
  }

  // 2. Create deduplicated AWS nodes
  for (const [serviceName, info] of awsServiceCounts) {
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
  for (const resource of resources) {
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

  // 4. Dagre layout (LR direction)
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "LR", nodesep: 50, ranksep: 200 });

  for (const node of nodes) {
    g.setNode(node.id, { width: 200, height: 60 });
  }
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  // Apply computed positions
  for (const node of nodes) {
    const pos = g.node(node.id);
    if (pos) {
      node.position = { x: pos.x - 100, y: pos.y - 30 };
    }
  }

  return { nodes, edges };
}
