"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import {
  ReactFlow,
  Controls,
  Background,
  type Node,
  type Edge,
  type NodeTypes,
  type NodeProps,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import {
  buildCanvasGraph,
  type AzureResourceWithRecommendation,
  type CanvasNode,
} from "@/lib/canvas-utils"

const confidenceEdgeColors: Record<string, string> = {
  High: "#22c55e",
  Medium: "#eab308",
  Low: "#f97316",
  None: "#ef4444",
}

function AzureNode({ data }: NodeProps<Node<CanvasNode["data"]>>) {
  return (
    <div className="rounded-lg border bg-blue-50 dark:bg-blue-950/30 px-3 py-2 text-xs min-w-[160px]">
      <div className="font-medium truncate">{data.label}</div>
      <div className="text-muted-foreground truncate">{data.category}</div>
      <Handle type="source" position={Position.Right} className="!bg-blue-500" />
    </div>
  )
}

function AwsNode({ data }: NodeProps<Node<CanvasNode["data"]>>) {
  return (
    <div className="rounded-lg border bg-orange-50 dark:bg-orange-950/30 px-3 py-2 text-xs min-w-[160px]">
      <Handle type="target" position={Position.Left} className="!bg-orange-500" />
      <div className="font-medium truncate">{data.label}</div>
      <div className="flex items-center gap-1">
        <span className="text-muted-foreground">{data.category}</span>
        {data.count && data.count > 1 && (
          <Badge variant="secondary" className="text-[10px] px-1 h-4">
            ×{data.count}
          </Badge>
        )}
      </div>
    </div>
  )
}

const nodeTypes: NodeTypes = {
  azure: AzureNode,
  aws: AwsNode,
}

interface ApiResource {
  id: string
  name: string
  type: string
  location: string | null
  recommendations: {
    awsService: string
    awsCategory: string
    confidence: string
    rationale: string
    migrationNotes: string
    alternatives: string
  }[]
}

interface DetailInfo {
  label: string
  type: "azure" | "aws"
  category: string
  confidence?: string
  count?: number
  resourceId?: string
}

export default function MappingCanvasPage() {
  const params = useParams<{ projectId: string }>()
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedNode, setSelectedNode] = useState<DetailInfo | null>(null)
  const [resources, setResources] = useState<ApiResource[]>([])

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/projects/${params.projectId}/mapping`)
        const json = await res.json()
        if (!res.ok) {
          setError(json.error ?? "Failed to load mappings")
          return
        }

        const apiResources = json.data as ApiResource[]
        setResources(apiResources)

        const withRecs: AzureResourceWithRecommendation[] = apiResources.map((r) => ({
          id: r.id,
          name: r.name,
          type: r.type,
          location: r.location,
          recommendations: r.recommendations.map((rec) => ({
            ...rec,
            alternatives: (() => {
              try {
                return JSON.parse(rec.alternatives)
              } catch {
                return []
              }
            })(),
          })),
        }))

        const graph = buildCanvasGraph(withRecs)

        const flowNodes: Node[] = graph.nodes.map((n) => ({
          id: n.id,
          type: n.type,
          position: n.position,
          data: n.data,
        }))

        const flowEdges: Edge[] = graph.edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          style: { stroke: confidenceEdgeColors[e.data.confidence] ?? "#888" },
          data: e.data,
        }))

        setNodes(flowNodes)
        setEdges(flowEdges)
      } catch {
        setError("Failed to load mappings")
      } finally {
        setLoading(false)
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.projectId])

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const d = node.data as CanvasNode["data"]
      setSelectedNode({
        label: d.label,
        type: node.type as "azure" | "aws",
        category: d.category,
        confidence: d.confidence,
        count: d.count,
        resourceId: d.resourceId,
      })
    },
    []
  )

  const selectedResource = useMemo(() => {
    if (!selectedNode?.resourceId) return null
    return resources.find((r) => r.id === selectedNode.resourceId) ?? null
  }, [selectedNode, resources])

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2">
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
                <BreadcrumbPage>Canvas View</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>
      <div className="flex flex-1 flex-col gap-2 p-4 pt-0">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/dashboard/migration/${params.projectId}/mapping`}>
              Table View
            </Link>
          </Button>
          <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-0.5 bg-green-500" /> High
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-0.5 bg-yellow-500" /> Medium
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-0.5 bg-orange-500" /> Low
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-0.5 bg-red-500" /> None
            </span>
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {loading ? (
          <Skeleton className="h-[500px] w-full rounded-xl" />
        ) : (
          <div className="h-[calc(100vh-12rem)] rounded-lg border">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={onNodeClick}
              nodeTypes={nodeTypes}
              fitView
              proOptions={{ hideAttribution: true }}
            >
              <Controls />
              <Background />
            </ReactFlow>
          </div>
        )}

        <Sheet open={!!selectedNode} onOpenChange={(open) => !open && setSelectedNode(null)}>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>{selectedNode?.label}</SheetTitle>
            </SheetHeader>
            {selectedNode && (
              <div className="grid gap-3 text-sm p-4">
                <div>
                  <span className="font-medium">Type: </span>
                  {selectedNode.type === "azure" ? "Azure Resource" : "AWS Service"}
                </div>
                <div>
                  <span className="font-medium">Category: </span>
                  {selectedNode.category}
                </div>
                {selectedNode.count && selectedNode.count > 1 && (
                  <div>
                    <span className="font-medium">Mapped from: </span>
                    {selectedNode.count} resources
                  </div>
                )}
                {selectedResource && (
                  <>
                    <Separator />
                    {selectedResource.recommendations.map((rec, i) => (
                      <div key={i} className="grid gap-1">
                        <div>
                          <span className="font-medium">AWS Service: </span>
                          {rec.awsService}
                        </div>
                        <div>
                          <span className="font-medium">Confidence: </span>
                          {rec.confidence}
                        </div>
                        <div>
                          <span className="font-medium">Rationale: </span>
                          {rec.rationale}
                        </div>
                        {rec.migrationNotes && (
                          <div>
                            <span className="font-medium">Migration Notes: </span>
                            {rec.migrationNotes}
                          </div>
                        )}
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </>
  )
}
