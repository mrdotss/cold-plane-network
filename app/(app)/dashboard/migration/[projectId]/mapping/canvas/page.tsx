"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ReactFlow,
  Controls,
  Background,
  MiniMap,
  BackgroundVariant,
  type Node,
  type Edge,
  type NodeTypes,
  type EdgeTypes,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TooltipProvider,
} from "@/components/ui/tooltip";
import {
  buildDualTopologyGraph,
  type DualTopologyNode,
  type DualTopologyEdge,
  type DualTopologyFilters,
} from "@/lib/canvas-utils";
import {
  buildAWSTopology,
  type MappingRecommendationInput,
} from "@/lib/migration/aws-topology-builder";
import type {
  AzureResourceInput,
  AzureResourceRelationship,
  RelationType,
  ConfidenceLevel,
} from "@/lib/migration/relationship-engine";
import { AzureResourceIcon } from "@/lib/migration/azure-icons";
import { AwsServiceIcon } from "@/lib/migration/aws-service-icons";
import { AzureResourceNode } from "@/components/migration/AzureResourceNode";
import { AWSResourceNode } from "@/components/migration/AWSResourceNode";
import { ResourceGroupNode } from "@/components/migration/ResourceGroupNode";
import { NoMappingNode } from "@/components/migration/NoMappingNode";
import { RGSummaryNode } from "@/components/migration/RGSummaryNode";
import { RelationshipEdge } from "@/components/migration/RelationshipEdge";
import { MappingEdge } from "@/components/migration/MappingEdge";
import { AggregatedEdge } from "@/components/migration/AggregatedEdge";
import {
  TopologyToolbar,
  ALL_RELATION_TYPES,
  ALL_CONFIDENCE_LEVELS,
  RELATION_TYPE_LABELS,
  type ViewMode,
} from "@/components/migration/TopologyToolbar";

/* ── CSS for animated dashed edges ── */
const DASH_ANIMATION_CSS = `
@keyframes dashmove {
  to { stroke-dashoffset: -12; }
}
`;

/* ── Constants ── */

const AUTO_COLLAPSE_NODE_THRESHOLD = 200;

const CONFIDENCE_BADGE_COLORS: Record<string, { bg: string; text: string }> = {
  High:     { bg: "bg-green-100 dark:bg-green-950/40",  text: "text-green-700 dark:text-green-400" },
  Medium:   { bg: "bg-yellow-100 dark:bg-yellow-950/40", text: "text-yellow-700 dark:text-yellow-400" },
  Low:      { bg: "bg-orange-100 dark:bg-orange-950/40", text: "text-orange-700 dark:text-orange-400" },
  Definite: { bg: "bg-blue-100 dark:bg-blue-950/40",    text: "text-blue-700 dark:text-blue-400" },
  None:     { bg: "bg-red-100 dark:bg-red-950/40",      text: "text-red-700 dark:text-red-400" },
};

/* ── Custom node/edge type registrations ── */

const nodeTypes: NodeTypes = {
  azure: AzureResourceNode,
  aws: AWSResourceNode,
  "resource-group": ResourceGroupNode,
  "no-mapping": NoMappingNode,
  "rg-summary": RGSummaryNode,
};

const edgeTypes: EdgeTypes = {
  relationship: RelationshipEdge,
  mapping: MappingEdge,
  aggregated: AggregatedEdge,
};

/* ── API response types ── */

interface ApiResource {
  id: string;
  name: string;
  type: string;
  location: string | null;
  resourceGroup: string | null;
  armId: string | null;
  raw: string;
  recommendations: Array<{
    id: string;
    azureResourceId: string;
    awsService: string;
    awsCategory: string;
    confidence: string;
    rationale: string;
    migrationNotes: string;
    alternatives: string;
  }>;
}

interface ApiRelationship {
  id: string;
  sourceResourceId: string;
  targetResourceId: string;
  relationType: string;
  confidence: string;
  method: string;
}

interface RelationshipResponse {
  relationships: ApiRelationship[];
  stats: {
    total: number;
    byType: Record<string, number>;
    byMethod: Record<string, number>;
    byConfidence: Record<string, number>;
  };
}

interface DetailInfo {
  label: string;
  type: "azure" | "aws" | "resource-group" | "no-mapping";
  category: string;
  resourceId?: string;
  resourceType?: string;
  resourceGroup?: string | null;
  location?: string | null;
  confidence?: string;
  awsService?: string;
}

/* ── Relationship stats bar ── */

function RelationshipStats({ stats }: { stats: RelationshipResponse["stats"] | null }) {
  if (!stats || stats.total === 0) return null;
  return (
    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
      <span className="font-semibold text-foreground">{stats.total} relationships</span>
      {Object.entries(stats.byType).map(([type, count]) => {
        const meta = RELATION_TYPE_LABELS[type as RelationType];
        return (
          <span key={type} className="flex items-center gap-1">
            <span className="h-1.5 w-3 rounded-sm" style={{ backgroundColor: meta?.color ?? "#888" }} />
            {count}
          </span>
        );
      })}
    </div>
  );
}

/* ── Canvas inner (needs ReactFlow context) ── */

function CanvasInner({
  azureResources,
  azureRelationships,
  mappingRecommendations,
  onSelectNode,
}: {
  azureResources: AzureResourceInput[];
  azureRelationships: AzureResourceRelationship[];
  mappingRecommendations: MappingRecommendationInput[];
  onSelectNode: (info: DetailInfo) => void;
}) {
  const { fitView } = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Filter state — smart defaults for large datasets
  const [viewMode, setViewMode] = useState<ViewMode>("azure-only");
  const [viewModeInit, setViewModeInit] = useState(false);
  const [activeRelTypes, setActiveRelTypes] = useState<Set<RelationType>>(new Set(ALL_RELATION_TYPES));
  const [activeConfLevels, setActiveConfLevels] = useState<Set<ConfidenceLevel>>(
    new Set<ConfidenceLevel>(["High", "Definite"]),
  );
  const [searchTerm, setSearchTerm] = useState("");

  // Progressive disclosure: which RGs are expanded (empty = overview mode)
  const [expandedRGs, setExpandedRGs] = useState<Set<string>>(new Set());

  const expandRG = useCallback((rg: string) => {
    setExpandedRGs(new Set([rg]));
  }, []);

  const collapseAll = useCallback(() => {
    setExpandedRGs(new Set());
  }, []);

  // Smart view mode default: "dual" for small datasets, "azure-only" for large
  useEffect(() => {
    if (!viewModeInit && azureResources.length > 0) {
      setViewMode(azureResources.length > 100 ? "azure-only" : "dual");
      setViewModeInit(true);
    }
  }, [azureResources.length, viewModeInit]);

  // Resource groups for filter
  const resourceGroups = useMemo(() => {
    const rgs = new Set<string>();
    for (const r of azureResources) {
      if (r.resourceGroup) rgs.add(r.resourceGroup);
    }
    return [...rgs].sort();
  }, [azureResources]);

  const [disabledRGs, setDisabledRGs] = useState<Set<string>>(new Set());

  // Active RGs = all resource groups minus disabled ones
  const activeRGs = useMemo(() => {
    const active = new Set<string>();
    for (const rg of resourceGroups) {
      if (!disabledRGs.has(rg)) active.add(rg);
    }
    return active;
  }, [resourceGroups, disabledRGs]);

  // Build AWS topology (client-side, pure function)
  const awsTopology = useMemo(
    () => buildAWSTopology(azureRelationships, mappingRecommendations, azureResources),
    [azureRelationships, mappingRecommendations, azureResources],
  );

  // Build dual topology graph with filters + progressive disclosure
  const graph = useMemo(() => {
    const filters: DualTopologyFilters = {
      resourceGroups: activeRGs.size === resourceGroups.length ? undefined : [...activeRGs],
      relationTypes: activeRelTypes.size === ALL_RELATION_TYPES.length ? undefined : [...activeRelTypes],
      confidenceLevels: activeConfLevels.size === ALL_CONFIDENCE_LEVELS.length ? undefined : [...activeConfLevels],
      searchTerm: searchTerm.trim() || undefined,
      viewMode,
      expandedRGs: [...expandedRGs],
    };

    return buildDualTopologyGraph({
      azureResources,
      azureRelationships,
      awsTopology,
      mappingRecommendations,
      filters,
    });
  }, [azureResources, azureRelationships, awsTopology, mappingRecommendations, activeRGs, resourceGroups.length, activeRelTypes, activeConfLevels, searchTerm, viewMode, expandedRGs]);

  // Auto-collapse resource groups when node count exceeds threshold
  const shouldAutoCollapse = graph.nodes.length > AUTO_COLLAPSE_NODE_THRESHOLD;

  // Convert DualTopologyNode/Edge to React Flow Node/Edge
  useEffect(() => {
    const flowNodes: Node[] = graph.nodes.map((n: DualTopologyNode) => ({
      id: n.id,
      type: n.type,
      position: n.position,
      data: n.data,
    }));

    const flowEdges: Edge[] = graph.edges.map((e: DualTopologyEdge) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: e.type,
      data: e.data,
      animated: e.data.animated,
      style: {
        stroke: e.data.color,
        strokeWidth: e.data.strokeWidth,
        strokeDasharray: e.data.strokeDasharray,
        opacity: 0.7,
      },
    }));

    setNodes(flowNodes);
    setEdges(flowEdges);

    // Fit view after layout change
    setTimeout(() => fitView({ padding: 0.12, duration: 300 }), 80);
  }, [graph, setNodes, setEdges, fitView]);

  // Toggle helpers
  const toggleRelType = useCallback((t: RelationType) => {
    setActiveRelTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  }, []);

  const toggleConfLevel = useCallback((c: ConfidenceLevel) => {
    setActiveConfLevels((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  }, []);

  const toggleRG = useCallback((rg: string) => {
    setDisabledRGs((prev) => {
      const next = new Set(prev);
      if (next.has(rg)) next.delete(rg);
      else next.add(rg);
      return next;
    });
  }, []);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      // Progressive disclosure: expand RG on click
      if (node.type === "rg-summary") {
        const d = node.data as DualTopologyNode["data"];
        expandRG(d.label);
        return;
      }

      const d = node.data as DualTopologyNode["data"];
      onSelectNode({
        label: d.label,
        type: node.type as DetailInfo["type"],
        category: d.category,
        resourceId: d.resourceId,
        resourceType: d.resourceType,
        resourceGroup: d.resourceGroup,
        location: d.location,
        confidence: d.confidence,
        awsService: d.awsService,
      });
    },
    [onSelectNode, expandRG],
  );

  const handleFitView = useCallback(() => {
    fitView({ padding: 0.12, duration: 300 });
  }, [fitView]);

  return (
    <div className="relative h-full">
      {/* Inject dash animation CSS */}
      <style dangerouslySetInnerHTML={{ __html: DASH_ANIMATION_CSS }} />

      {/* Topology toolbar with filters and search */}
      <TopologyToolbar
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        activeRelTypes={activeRelTypes}
        onToggleRelType={toggleRelType}
        activeConfLevels={activeConfLevels}
        onToggleConfLevel={toggleConfLevel}
        resourceGroups={resourceGroups}
        activeRGs={activeRGs}
        onToggleRG={toggleRG}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onFitView={handleFitView}
        hasExpandedRGs={expandedRGs.size > 0}
        onCollapseAll={collapseAll}
      />

      {shouldAutoCollapse && (
        <div className="absolute bottom-14 left-3 z-10 rounded-md border bg-yellow-50 dark:bg-yellow-950/30 px-3 py-1.5 text-[10px] text-yellow-700 dark:text-yellow-400">
          Large graph ({graph.nodes.length} nodes) — resource groups auto-collapsed
        </div>
      )}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.12 }}
        minZoom={0.02}
        maxZoom={2.5}
        onlyRenderVisibleElements
        proOptions={{ hideAttribution: true }}
      >
        <Controls
          showInteractive={false}
          className="!bg-background !border !border-border !shadow-sm !rounded-lg"
        />
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
        <MiniMap
          nodeColor={(node) => {
            if (node.type === "azure") return "#3b82f6";
            if (node.type === "aws") return "#f97316";
            if (node.type === "resource-group" || node.type === "rg-summary") return "#93c5fd";
            return "#9ca3af";
          }}
          maskColor="rgba(0,0,0,0.08)"
          className="!bg-background/90 !backdrop-blur-sm !border !border-border !rounded-lg"
          pannable
          zoomable
        />
      </ReactFlow>
    </div>
  );
}

/* ── Main page ── */

export default function MigrationTopologyPage() {
  const params = useParams<{ projectId: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<DetailInfo | null>(null);

  // Data state
  const [apiResources, setApiResources] = useState<ApiResource[]>([]);
  const [azureResources, setAzureResources] = useState<AzureResourceInput[]>([]);
  const [azureRelationships, setAzureRelationships] = useState<AzureResourceRelationship[]>([]);
  const [mappingRecommendations, setMappingRecommendations] = useState<MappingRecommendationInput[]>([]);
  const [relStats, setRelStats] = useState<RelationshipResponse["stats"] | null>(null);

  // Fetch all data in parallel
  useEffect(() => {
    async function load() {
      try {
        const [mappingRes, relRes] = await Promise.all([
          fetch(`/api/projects/${params.projectId}/mapping`),
          fetch(`/api/projects/${params.projectId}/relationships`),
        ]);

        // Process mapping response (resources + recommendations)
        if (mappingRes.ok) {
          const mappingJson = await mappingRes.json();
          const resources = mappingJson.data as ApiResource[];
          setApiResources(resources);

          // Convert to AzureResourceInput for the topology builder
          const azInputs: AzureResourceInput[] = resources.map((r) => ({
            id: r.id,
            name: r.name,
            type: r.type,
            location: r.location,
            resourceGroup: r.resourceGroup,
            armId: r.armId,
            raw: r.raw ?? "{}",
          }));
          setAzureResources(azInputs);

          // Extract mapping recommendations
          const recs: MappingRecommendationInput[] = resources.flatMap((r) =>
            r.recommendations.map((rec) => ({
              azureResourceId: r.id,
              awsService: rec.awsService,
              awsCategory: rec.awsCategory,
              confidence: rec.confidence,
            })),
          );
          setMappingRecommendations(recs);
        } else {
          setError("Failed to load resources");
        }

        // Process relationships response (graceful — canvas works without relationships)
        if (relRes.ok) {
          const relJson = (await relRes.json()) as RelationshipResponse;
          const rels: AzureResourceRelationship[] = relJson.relationships.map((r) => ({
            sourceResourceId: r.sourceResourceId,
            targetResourceId: r.targetResourceId,
            relationType: r.relationType as RelationType,
            confidence: r.confidence as ConfidenceLevel,
            method: r.method as AzureResourceRelationship["method"],
          }));
          setAzureRelationships(rels);
          setRelStats(relJson.stats);
        }
        // If relationships fail, we still render the canvas without relationship edges
      } catch {
        setError("Failed to load canvas data");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params.projectId]);

  // Find selected resource details
  const selectedResource = useMemo(() => {
    if (!selectedNode?.resourceId) return null;
    return apiResources.find((r) => r.id === selectedNode.resourceId) ?? null;
  }, [selectedNode, apiResources]);

  // Find relationships for selected resource
  const selectedRelationships = useMemo(() => {
    if (!selectedNode?.resourceId) return [];
    const rid = selectedNode.resourceId;
    return azureRelationships.filter(
      (r) => r.sourceResourceId === rid || r.targetResourceId === rid,
    );
  }, [selectedNode, azureRelationships]);

  // Resource lookup for relationship display
  const resourceById = useMemo(() => {
    const map = new Map<string, ApiResource>();
    for (const r of apiResources) map.set(r.id, r);
    return map;
  }, [apiResources]);

  return (
    <TooltipProvider delayDuration={200}>
      <header className="flex h-14 shrink-0 items-center gap-2 border-b">
        <div className="flex items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 data-vertical:h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href="/dashboard/migration">Migration Advisor</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href={`/dashboard/migration/${params.projectId}`}>Project</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Topology Canvas</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <div className="ml-auto flex items-center gap-3 px-4">
          {!loading && <RelationshipStats stats={relStats} />}
          {!loading && apiResources.length > 0 && (
            <>
              <div className="mx-1 h-4 w-px bg-border" />
              <span className="text-xs text-muted-foreground">
                {apiResources.length} resources
              </span>
            </>
          )}
          <div className="mx-1 h-4 w-px bg-border" />
          <Button variant="outline" size="sm" asChild>
            <Link href={`/dashboard/migration/${params.projectId}/mapping`}>
              Table View
            </Link>
          </Button>
        </div>
      </header>

      <div className="flex flex-1 flex-col">
        {error && <p className="text-sm text-destructive p-4">{error}</p>}

        {loading ? (
          <Skeleton className="m-4 h-[500px] w-full rounded-xl" />
        ) : (
          <div className="flex-1 min-h-0">
            <ReactFlowProvider>
              <CanvasInner
                azureResources={azureResources}
                azureRelationships={azureRelationships}
                mappingRecommendations={mappingRecommendations}
                onSelectNode={setSelectedNode}
              />
            </ReactFlowProvider>
          </div>
        )}

        {/* Detail Sheet */}
        <Sheet
          open={!!selectedNode}
          onOpenChange={(open) => !open && setSelectedNode(null)}
        >
          <SheetContent className="overflow-y-auto sm:max-w-md">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                {selectedNode?.type === "azure" && selectedNode.resourceType && (
                  <AzureResourceIcon resourceType={selectedNode.resourceType} size={22} />
                )}
                {selectedNode?.type === "aws" && selectedNode.awsService && (
                  <AwsServiceIcon service={selectedNode.awsService} size={24} />
                )}
                {selectedNode?.type === "no-mapping" && (
                  <div className="flex h-6 w-6 items-center justify-center rounded bg-gray-100 dark:bg-gray-800">
                    <span className="text-[8px] text-gray-400">?</span>
                  </div>
                )}
                <span className="truncate">{selectedNode?.label}</span>
              </SheetTitle>
            </SheetHeader>

            {selectedNode && (
              <div className="grid gap-4 text-sm p-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline">
                    {selectedNode.type === "azure" ? "Azure Resource" :
                     selectedNode.type === "aws" ? "AWS Service" :
                     selectedNode.type === "resource-group" ? "Resource Group" :
                     "No Mapping"}
                  </Badge>
                  {selectedNode.category && (
                    <Badge variant="secondary">{selectedNode.category}</Badge>
                  )}
                  {selectedNode.confidence && (
                    <Badge
                      className={`ml-auto ${CONFIDENCE_BADGE_COLORS[selectedNode.confidence]?.bg ?? ""} ${CONFIDENCE_BADGE_COLORS[selectedNode.confidence]?.text ?? ""}`}
                      variant="outline"
                    >
                      {selectedNode.confidence}
                    </Badge>
                  )}
                </div>

                {/* Azure resource details */}
                {selectedResource && (
                  <>
                    <Separator />
                    <div className="grid gap-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Azure Type</span>
                        <span className="font-mono text-[11px] text-right max-w-[60%] truncate">
                          {selectedResource.type}
                        </span>
                      </div>
                      {selectedResource.location && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Location</span>
                          <span>{selectedResource.location}</span>
                        </div>
                      )}
                      {selectedResource.resourceGroup && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Resource Group</span>
                          <span>{selectedResource.resourceGroup}</span>
                        </div>
                      )}
                    </div>

                    {/* Relationships */}
                    {selectedRelationships.length > 0 && (
                      <>
                        <Separator />
                        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          {selectedRelationships.length} Relationship{selectedRelationships.length !== 1 ? "s" : ""}
                        </div>
                        <div className="grid gap-1.5">
                          {selectedRelationships.map((rel, i) => {
                            const isSource = rel.sourceResourceId === selectedNode.resourceId;
                            const otherId = isSource ? rel.targetResourceId : rel.sourceResourceId;
                            const other = resourceById.get(otherId);
                            const meta = RELATION_TYPE_LABELS[rel.relationType];
                            return (
                              <div key={i} className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs">
                                <span
                                  className="h-2 w-2 rounded-full shrink-0"
                                  style={{ backgroundColor: meta?.color ?? "#888" }}
                                />
                                <span className="text-muted-foreground">
                                  {isSource ? "→" : "←"}
                                </span>
                                <span className="truncate font-medium">
                                  {other?.name ?? otherId.slice(0, 8)}
                                </span>
                                <Badge variant="outline" className="text-[9px] px-1 h-4 ml-auto shrink-0">
                                  {rel.relationType}
                                </Badge>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}

                    {/* AWS Mapping */}
                    {selectedResource.recommendations.length > 0 && (
                      <>
                        <Separator />
                        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          AWS Mapping
                        </div>
                        {selectedResource.recommendations.map((rec, i) => (
                          <div key={i} className="rounded-lg border p-3 grid gap-2">
                            <div className="flex items-center gap-2">
                              <AwsServiceIcon service={rec.awsService} size={22} />
                              <span className="font-medium text-xs">{rec.awsService}</span>
                              <Badge
                                className={`text-[10px] ml-auto ${CONFIDENCE_BADGE_COLORS[rec.confidence]?.bg ?? ""} ${CONFIDENCE_BADGE_COLORS[rec.confidence]?.text ?? ""}`}
                                variant="outline"
                              >
                                {rec.confidence}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              {rec.rationale}
                            </p>
                            {rec.migrationNotes && (
                              <div className="rounded-md bg-muted p-2.5 text-xs">
                                <span className="font-semibold">Migration Notes: </span>
                                {rec.migrationNotes}
                              </div>
                            )}
                          </div>
                        ))}
                      </>
                    )}
                  </>
                )}
              </div>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </TooltipProvider>
  );
}
