"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
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
  type NodeProps,
  Handle,
  Position,
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
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  buildCanvasGraph,
  type AzureResourceWithRecommendation,
  type CanvasNode,
} from "@/lib/canvas-utils";
import { AwsServiceIcon } from "@/lib/migration/aws-service-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  FilterIcon,
  Search01Icon,
  ArrowRight01Icon,
  CheckmarkSquare02Icon,
  SquareIcon,
  Cancel01Icon,
  ArrowShrinkIcon,
} from "@hugeicons/core-free-icons";

/* ──────────────────────────────────────────────────────────────── */
/* Constants                                                        */
/* ──────────────────────────────────────────────────────────────── */

const CONFIDENCE_COLORS: Record<string, { stroke: string; bg: string; text: string }> = {
  High:   { stroke: "#22c55e", bg: "bg-green-100 dark:bg-green-950/40",  text: "text-green-700 dark:text-green-400" },
  Medium: { stroke: "#eab308", bg: "bg-yellow-100 dark:bg-yellow-950/40", text: "text-yellow-700 dark:text-yellow-400" },
  Low:    { stroke: "#f97316", bg: "bg-orange-100 dark:bg-orange-950/40", text: "text-orange-700 dark:text-orange-400" },
  None:   { stroke: "#ef4444", bg: "bg-red-100 dark:bg-red-950/40",      text: "text-red-700 dark:text-red-400" },
};

const CATEGORY_META: Record<string, { color: string; borderColor: string; dotColor: string }> = {
  Compute:     { color: "text-orange-600 dark:text-orange-400", borderColor: "border-l-orange-500", dotColor: "#f97316" },
  Networking:  { color: "text-purple-600 dark:text-purple-400", borderColor: "border-l-purple-500", dotColor: "#a855f7" },
  Storage:     { color: "text-green-600 dark:text-green-400",   borderColor: "border-l-green-500",  dotColor: "#22c55e" },
  Database:    { color: "text-blue-600 dark:text-blue-400",     borderColor: "border-l-blue-500",   dotColor: "#3b82f6" },
  Security:    { color: "text-red-600 dark:text-red-400",       borderColor: "border-l-red-500",    dotColor: "#ef4444" },
  Monitoring:  { color: "text-pink-600 dark:text-pink-400",     borderColor: "border-l-pink-500",   dotColor: "#ec4899" },
  Integration: { color: "text-indigo-600 dark:text-indigo-400", borderColor: "border-l-indigo-500", dotColor: "#6366f1" },
  Serverless:  { color: "text-amber-600 dark:text-amber-400",   borderColor: "border-l-amber-500",  dotColor: "#f59e0b" },
  Containers:  { color: "text-sky-600 dark:text-sky-400",       borderColor: "border-l-sky-500",    dotColor: "#0ea5e9" },
  "AI-ML":     { color: "text-cyan-600 dark:text-cyan-400",     borderColor: "border-l-cyan-500",   dotColor: "#06b6d4" },
  Unknown:     { color: "text-gray-500 dark:text-gray-400",     borderColor: "border-l-gray-400",   dotColor: "#9ca3af" },
};

function getCategoryMeta(cat: string) {
  return CATEGORY_META[cat] ?? CATEGORY_META.Unknown;
}

/** Shorten Azure type for display: "microsoft.compute/virtualmachines" → "compute/virtualmachines" */
function shortAzureType(type: string): string {
  return type.replace(/^microsoft\./i, "");
}

/* ──────────────────────────────────────────────────────────────── */
/* Azure Node                                                       */
/* ──────────────────────────────────────────────────────────────── */

function AzureNode({ data, selected }: NodeProps<Node<CanvasNode["data"] & { azureType?: string; highlighted?: boolean }>>) {
  const category = data.category ?? "Unknown";
  const meta = getCategoryMeta(category);
  const confidence = data.confidence ?? "None";
  const confColor = CONFIDENCE_COLORS[confidence];
  const highlighted = data.highlighted;

  return (
    <div
      className={`
        rounded-lg border-l-4 border bg-background shadow-sm
        min-w-[200px] max-w-[240px] px-3 py-2 cursor-pointer
        transition-all duration-200
        ${meta.borderColor}
        ${selected ? "ring-2 ring-primary shadow-md" : "border-border"}
        ${highlighted ? "ring-2 ring-yellow-400 shadow-lg" : ""}
        ${highlighted === false ? "opacity-30" : "hover:shadow-md"}
      `}
    >
      <div className="flex items-center gap-2">
        {/* Azure badge with category color */}
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800">
          <span className="text-[9px] font-bold text-blue-600 dark:text-blue-400">Az</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-semibold text-foreground">
            {data.label}
          </div>
          {data.azureType && (
            <div className="truncate text-[9px] font-mono text-muted-foreground">
              {shortAzureType(data.azureType)}
            </div>
          )}
        </div>
        {/* Confidence dot */}
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full border border-background"
          style={{ backgroundColor: confColor?.stroke ?? "#9ca3af" }}
          title={`Confidence: ${confidence}`}
        />
      </div>
      <Handle type="source" position={Position.Right} className="!w-2 !h-2 !border-background" style={{ background: meta.dotColor }} />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────── */
/* AWS Node                                                         */
/* ──────────────────────────────────────────────────────────────── */

function AwsNode({ data, selected }: NodeProps<Node<CanvasNode["data"] & { highlighted?: boolean }>>) {
  const category = data.category ?? "Unknown";
  const meta = getCategoryMeta(category);
  const highlighted = data.highlighted;

  return (
    <div
      className={`
        rounded-lg border-l-4 border bg-background shadow-sm
        min-w-[200px] max-w-[260px] px-3 py-2 cursor-pointer
        transition-all duration-200
        ${meta.borderColor}
        ${selected ? "ring-2 ring-primary shadow-md" : "border-border"}
        ${highlighted ? "ring-2 ring-yellow-400 shadow-lg" : ""}
        ${highlighted === false ? "opacity-30" : "hover:shadow-md"}
      `}
    >
      <Handle type="target" position={Position.Left} className="!w-2 !h-2 !border-background" style={{ background: meta.dotColor }} />
      <div className="flex items-center gap-2">
        <div className="shrink-0">
          <AwsServiceIcon service={data.label} size={28} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-semibold text-foreground">
            {data.label}
          </div>
          <div className="flex items-center gap-1">
            <span className={`truncate text-[10px] font-medium ${meta.color}`}>{category}</span>
            {data.count && data.count > 1 && (
              <Badge variant="secondary" className="text-[9px] px-1.5 h-4 font-bold ml-auto">
                {data.count}
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const nodeTypes: NodeTypes = {
  azure: AzureNode,
  aws: AwsNode,
};

/* ──────────────────────────────────────────────────────────────── */
/* Types                                                            */
/* ──────────────────────────────────────────────────────────────── */

interface ApiResource {
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
    alternatives: string;
  }[];
}

interface DetailInfo {
  label: string;
  type: "azure" | "aws";
  category: string;
  confidence?: string;
  count?: number;
  resourceId?: string;
}

/* ──────────────────────────────────────────────────────────────── */
/* Category Toggle Panel                                            */
/* ──────────────────────────────────────────────────────────────── */

function CategoryPanel({
  categories,
  hiddenCategories,
  onToggle,
  onShowAll,
  onHideAll,
  categoryCounts,
}: {
  categories: string[];
  hiddenCategories: Set<string>;
  onToggle: (cat: string) => void;
  onShowAll: () => void;
  onHideAll: () => void;
  categoryCounts: Record<string, { azure: number; aws: number }>;
}) {
  return (
    <div className="absolute top-3 left-3 z-10 rounded-xl border bg-background/95 backdrop-blur-sm shadow-lg p-3 w-56">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-foreground">Categories</span>
        <div className="flex gap-1">
          <button onClick={onShowAll} className="text-[10px] text-primary hover:underline">
            All
          </button>
          <span className="text-muted-foreground text-[10px]">·</span>
          <button onClick={onHideAll} className="text-[10px] text-primary hover:underline">
            None
          </button>
        </div>
      </div>
      <div className="grid gap-0.5">
        {categories.map((cat) => {
          const meta = getCategoryMeta(cat);
          const hidden = hiddenCategories.has(cat);
          const counts = categoryCounts[cat];
          return (
            <button
              key={cat}
              onClick={() => onToggle(cat)}
              className={`
                flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-all
                ${hidden ? "opacity-40 hover:opacity-60" : "hover:bg-muted"}
              `}
            >
              <HugeiconsIcon
                icon={hidden ? SquareIcon : CheckmarkSquare02Icon}
                size={14}
                className={hidden ? "text-muted-foreground" : "text-primary"}
              />
              <span
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: meta.dotColor }}
              />
              <span className={`flex-1 text-left ${hidden ? "text-muted-foreground" : "text-foreground font-medium"}`}>
                {cat}
              </span>
              {counts && (
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  {counts.azure + counts.aws}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────── */
/* Summary Stats                                                    */
/* ──────────────────────────────────────────────────────────────── */

function SummaryStats({ resources }: { resources: ApiResource[] }) {
  const stats = useMemo(() => {
    const total = resources.length;
    const high = resources.filter((r) => r.recommendations.some((rec) => rec.confidence === "High")).length;
    const medium = resources.filter((r) => r.recommendations.some((rec) => rec.confidence === "Medium")).length;
    const low = resources.filter((r) => r.recommendations.some((rec) => rec.confidence === "Low")).length;
    const none = total - high - medium - low;
    const pct = total > 0 ? Math.round(((high + medium) / total) * 100) : 0;
    return { total, high, medium, low, none, pct };
  }, [resources]);

  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="font-semibold text-foreground">{stats.total} resources</span>
      <div className="flex items-center gap-0.5 h-2 w-24 rounded-full overflow-hidden bg-muted">
        {stats.high > 0 && (
          <div className="h-full bg-green-500" style={{ width: `${(stats.high / stats.total) * 100}%` }} />
        )}
        {stats.medium > 0 && (
          <div className="h-full bg-yellow-500" style={{ width: `${(stats.medium / stats.total) * 100}%` }} />
        )}
        {stats.low > 0 && (
          <div className="h-full bg-orange-500" style={{ width: `${(stats.low / stats.total) * 100}%` }} />
        )}
        {stats.none > 0 && (
          <div className="h-full bg-red-500" style={{ width: `${(stats.none / stats.total) * 100}%` }} />
        )}
      </div>
      <span className="font-medium text-muted-foreground">{stats.pct}% ready</span>
      <div className="mx-1 h-4 w-px bg-border" />
      <span className="text-green-600">{stats.high} High</span>
      <span className="text-yellow-600">{stats.medium} Med</span>
      <span className="text-orange-600">{stats.low} Low</span>
      <span className="text-red-600">{stats.none} None</span>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────── */
/* Canvas Inner (needs ReactFlow context)                           */
/* ──────────────────────────────────────────────────────────────── */

function CanvasInner({
  allNodes,
  allEdges,
  resources,
  categories,
  categoryCounts,
  onSelectNode,
}: {
  allNodes: Node[];
  allEdges: Edge[];
  resources: ApiResource[];
  categories: string[];
  categoryCounts: Record<string, { azure: number; aws: number }>;
  onSelectNode: (info: DetailInfo) => void;
}) {
  const { fitView } = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  // Apply category visibility + search highlighting
  useEffect(() => {
    if (allNodes.length === 0) return;

    const query = searchQuery.toLowerCase().trim();

    // Build set of visible resource IDs based on hidden categories
    const visibleResourceIds = new Set<string>();
    const visibleAwsServices = new Set<string>();

    for (const r of resources) {
      const cat = r.recommendations[0]?.awsCategory ?? "Unknown";
      if (hiddenCategories.has(cat)) continue;
      visibleResourceIds.add(r.id);
      for (const rec of r.recommendations) {
        if (!hiddenCategories.has(rec.awsCategory)) {
          visibleAwsServices.add(rec.awsService);
        }
      }
    }

    const filteredNodes = allNodes
      .filter((n) => {
        if (n.type === "azure") {
          const rid = (n.data as CanvasNode["data"]).resourceId;
          return rid ? visibleResourceIds.has(rid) : true;
        }
        return visibleAwsServices.has((n.data as CanvasNode["data"]).label);
      })
      .map((n) => {
        if (!query) return { ...n, data: { ...n.data, highlighted: undefined } };
        const label = ((n.data as CanvasNode["data"]).label ?? "").toLowerCase();
        const matches = label.includes(query);
        return { ...n, data: { ...n.data, highlighted: matches ? true : false } };
      });

    const visibleNodeIds = new Set(filteredNodes.map((n) => n.id));
    const filteredEdges = allEdges.filter(
      (e) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target)
    );

    setNodes(filteredNodes);
    setEdges(filteredEdges);

    // Fit view after filter change
    setTimeout(() => fitView({ padding: 0.15, duration: 300 }), 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hiddenCategories, searchQuery, allNodes, allEdges, resources]);

  const toggleCategory = useCallback((cat: string) => {
    setHiddenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }, []);

  const showAll = useCallback(() => setHiddenCategories(new Set()), []);
  const hideAll = useCallback(() => setHiddenCategories(new Set(categories)), [categories]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const d = node.data as CanvasNode["data"];
      onSelectNode({
        label: d.label,
        type: node.type as "azure" | "aws",
        category: d.category,
        confidence: d.confidence,
        count: d.count,
        resourceId: d.resourceId,
      });
    },
    [onSelectNode]
  );

  return (
    <div className="relative h-full">
      {/* Category toggle panel */}
      <CategoryPanel
        categories={categories}
        hiddenCategories={hiddenCategories}
        onToggle={toggleCategory}
        onShowAll={showAll}
        onHideAll={hideAll}
        categoryCounts={categoryCounts}
      />

      {/* Search bar */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1">
        <div className="relative">
          <HugeiconsIcon icon={Search01Icon} size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchRef}
            type="text"
            placeholder="Search resources..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 w-52 pl-8 pr-8 text-xs bg-background/95 backdrop-blur-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <HugeiconsIcon icon={Cancel01Icon} size={12} />
            </button>
          )}
        </div>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.05}
        maxZoom={2.5}
        proOptions={{ hideAttribution: true }}
      >
        <Controls
          showInteractive={false}
          className="!bg-background !border !border-border !shadow-sm !rounded-lg"
        />
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
        <MiniMap
          nodeColor={(node) => {
            const cat = (node.data as CanvasNode["data"])?.category ?? "Unknown";
            return getCategoryMeta(cat).dotColor;
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

/* ──────────────────────────────────────────────────────────────── */
/* Main Page                                                        */
/* ──────────────────────────────────────────────────────────────── */

export default function MappingCanvasPage() {
  const params = useParams<{ projectId: string }>();
  const [allNodes, setAllNodes] = useState<Node[]>([]);
  const [allEdges, setAllEdges] = useState<Edge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<DetailInfo | null>(null);
  const [resources, setResources] = useState<ApiResource[]>([]);

  // Fetch mapping data
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/projects/${params.projectId}/mapping`);
        const json = await res.json();
        if (!res.ok) {
          setError(json.error ?? "Failed to load mappings");
          return;
        }

        const apiResources = json.data as ApiResource[];
        setResources(apiResources);

        const withRecs: AzureResourceWithRecommendation[] = apiResources.map(
          (r) => ({
            id: r.id,
            name: r.name,
            type: r.type,
            location: r.location,
            recommendations: r.recommendations.map((rec) => ({
              ...rec,
              alternatives: (() => {
                try {
                  return JSON.parse(rec.alternatives);
                } catch {
                  return [];
                }
              })(),
            })),
          })
        );

        const graph = buildCanvasGraph(withRecs);

        // Build flow nodes with extra metadata
        const resourceMap = new Map(apiResources.map((r) => [r.id, r]));
        const flowNodes: Node[] = graph.nodes.map((n) => {
          const extra: Record<string, unknown> = {};
          if (n.type === "azure" && n.data.resourceId) {
            const r = resourceMap.get(n.data.resourceId);
            if (r) extra.azureType = r.type;
          }
          return {
            id: n.id,
            type: n.type,
            position: n.position,
            data: { ...n.data, ...extra },
          };
        });

        const flowEdges: Edge[] = graph.edges.map((e) => {
          const color = CONFIDENCE_COLORS[e.data.confidence]?.stroke ?? "#888";
          return {
            id: e.id,
            source: e.source,
            target: e.target,
            animated: e.data.confidence === "High",
            style: { stroke: color, strokeWidth: 1.5, opacity: 0.7 },
            markerEnd: { type: "arrowclosed" as const, color },
            data: e.data,
          };
        });

        setAllNodes(flowNodes);
        setAllEdges(flowEdges);
      } catch {
        setError("Failed to load mappings");
      } finally {
        setLoading(false);
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.projectId]);

  // Categories and counts
  const { categories, categoryCounts } = useMemo(() => {
    const counts: Record<string, { azure: number; aws: number }> = {};
    const awsPerCategory = new Map<string, Set<string>>();

    for (const r of resources) {
      for (const rec of r.recommendations) {
        const cat = rec.awsCategory || "Unknown";
        if (!counts[cat]) counts[cat] = { azure: 0, aws: 0 };
        counts[cat].azure++;
        if (!awsPerCategory.has(cat)) awsPerCategory.set(cat, new Set());
        awsPerCategory.get(cat)!.add(rec.awsService);
      }
    }
    for (const [cat, services] of awsPerCategory) {
      if (counts[cat]) counts[cat].aws = services.size;
    }
    return { categories: Object.keys(counts).sort(), categoryCounts: counts };
  }, [resources]);

  const selectedResource = useMemo(() => {
    if (!selectedNode?.resourceId) return null;
    return resources.find((r) => r.id === selectedNode.resourceId) ?? null;
  }, [selectedNode, resources]);

  const selectedAwsMappedResources = useMemo(() => {
    if (!selectedNode || selectedNode.type !== "aws") return [];
    return resources.filter((r) =>
      r.recommendations.some((rec) => rec.awsService === selectedNode.label)
    );
  }, [selectedNode, resources]);

  return (
    <>
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
                  <Link href={`/dashboard/migration/${params.projectId}`}>
                    Project
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Canvas View</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        {/* Toolbar — right side */}
        <div className="ml-auto flex items-center gap-3 px-4">
          {!loading && resources.length > 0 && (
            <SummaryStats resources={resources} />
          )}
          <div className="mx-1 h-4 w-px bg-border" />
          {/* Confidence legend */}
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            {Object.entries(CONFIDENCE_COLORS).map(([level, c]) => (
              <span key={level} className="flex items-center gap-1">
                <span className="inline-block h-2 w-4 rounded-sm" style={{ backgroundColor: c.stroke }} />
                {level}
              </span>
            ))}
          </div>
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
                allNodes={allNodes}
                allEdges={allEdges}
                resources={resources}
                categories={categories}
                categoryCounts={categoryCounts}
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
                {selectedNode?.type === "aws" && (
                  <AwsServiceIcon service={selectedNode.label} size={28} />
                )}
                {selectedNode?.type === "azure" && (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800">
                    <span className="text-[9px] font-bold text-blue-600 dark:text-blue-400">Az</span>
                  </div>
                )}
                <span className="truncate">{selectedNode?.label}</span>
              </SheetTitle>
            </SheetHeader>

            {selectedNode && (
              <div className="grid gap-4 text-sm p-4">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {selectedNode.type === "azure" ? "Azure Resource" : "AWS Service"}
                  </Badge>
                  <Badge variant="secondary">{selectedNode.category}</Badge>
                  {selectedNode.confidence && (
                    <Badge
                      className={`ml-auto ${CONFIDENCE_COLORS[selectedNode.confidence]?.bg ?? ""} ${CONFIDENCE_COLORS[selectedNode.confidence]?.text ?? ""}`}
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
                        <span className="font-mono text-[11px] text-right max-w-[60%] truncate">{selectedResource.type}</span>
                      </div>
                      {selectedResource.location && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Location</span>
                          <span>{selectedResource.location}</span>
                        </div>
                      )}
                    </div>
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
                            className={`text-[10px] ml-auto ${CONFIDENCE_COLORS[rec.confidence]?.bg ?? ""} ${CONFIDENCE_COLORS[rec.confidence]?.text ?? ""}`}
                            variant="outline"
                          >
                            {rec.confidence}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">{rec.rationale}</p>
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

                {/* AWS service details — all mapped resources */}
                {selectedNode.type === "aws" && selectedAwsMappedResources.length > 0 && (
                  <>
                    <Separator />
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {selectedAwsMappedResources.length} Azure resource{selectedAwsMappedResources.length !== 1 ? "s" : ""} mapped
                    </div>
                    {selectedAwsMappedResources.map((r) => {
                      const rec = r.recommendations.find(
                        (rc) => rc.awsService === selectedNode.label
                      );
                      return (
                        <div key={r.id} className="rounded-lg border p-3 grid gap-1.5">
                          <div className="flex items-center gap-2">
                            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800">
                              <span className="text-[7px] font-bold text-blue-600 dark:text-blue-400">Az</span>
                            </div>
                            <span className="font-medium text-xs truncate">{r.name}</span>
                            {rec && (
                              <Badge
                                className={`text-[10px] ml-auto ${CONFIDENCE_COLORS[rec.confidence]?.bg ?? ""} ${CONFIDENCE_COLORS[rec.confidence]?.text ?? ""}`}
                                variant="outline"
                              >
                                {rec.confidence}
                              </Badge>
                            )}
                          </div>
                          <div className="text-[10px] text-muted-foreground font-mono truncate">
                            {r.type}
                          </div>
                          {rec?.rationale && (
                            <p className="text-[11px] text-muted-foreground leading-relaxed">{rec.rationale}</p>
                          )}
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
