"use client"

import { useEffect, useState, useMemo } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import {
  useReactTable,
  getCoreRowModel,
  getExpandedRowModel,
  flexRender,
  type ColumnDef,
} from "@tanstack/react-table"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { type MappingRow, applyFilters } from "@/lib/filtering"

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

const confidenceColors: Record<string, string> = {
  High: "bg-green-500/10 text-green-700 dark:text-green-400",
  Medium: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
  Low: "bg-orange-500/10 text-orange-700 dark:text-orange-400",
  None: "bg-red-500/10 text-red-700 dark:text-red-400",
}

const columns: ColumnDef<MappingRow>[] = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "type", header: "Azure Type" },
  { accessorKey: "location", header: "Location", cell: ({ getValue }) => getValue() || "—" },
  { accessorKey: "awsService", header: "AWS Service" },
  { accessorKey: "awsCategory", header: "Category" },
  {
    accessorKey: "confidence",
    header: "Confidence",
    cell: ({ getValue }) => {
      const val = getValue<string>()
      return (
        <Badge variant="outline" className={confidenceColors[val] ?? ""}>
          {val}
        </Badge>
      )
    },
  },
  { accessorKey: "rationale", header: "Rationale" },
]

export default function MappingTablePage() {
  const params = useParams<{ projectId: string }>()
  const [rows, setRows] = useState<MappingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confidenceFilter, setConfidenceFilter] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  async function loadData() {
    try {
      const res = await fetch(`/api/projects/${params.projectId}/mapping`)
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? "Failed to load mappings")
        return
      }
      const mapped: MappingRow[] = (json.data as ApiResource[]).flatMap((r) =>
        r.recommendations.length > 0
          ? r.recommendations.map((rec) => ({
              name: r.name,
              type: r.type,
              location: r.location,
              awsService: rec.awsService,
              awsCategory: rec.awsCategory,
              confidence: rec.confidence,
              rationale: rec.rationale,
              migrationNotes: rec.migrationNotes,
              alternatives: rec.alternatives,
            }))
          : [
              {
                name: r.name,
                type: r.type,
                location: r.location,
                awsService: "",
                awsCategory: "",
                confidence: "None",
                rationale: "No mapping run yet",
                migrationNotes: "",
                alternatives: "[]",
              },
            ]
      )
      setRows(mapped)
    } catch {
      setError("Failed to load mappings")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.projectId])

  async function handleRunMapping() {
    setRunning(true)
    setError(null)
    try {
      const res = await fetch(`/api/projects/${params.projectId}/mapping`, {
        method: "POST",
      })
      if (!res.ok) {
        const json = await res.json()
        setError(json.error ?? "Mapping failed")
        return
      }
      await loadData()
    } catch {
      setError("Mapping failed")
    } finally {
      setRunning(false)
    }
  }

  const filteredRows = useMemo(
    () => applyFilters(rows, { confidence: confidenceFilter, category: categoryFilter }),
    [rows, confidenceFilter, categoryFilter]
  )

  const categories = useMemo(
    () => [...new Set(rows.map((r) => r.awsCategory).filter(Boolean))],
    [rows]
  )

  const table = useReactTable({
    data: filteredRows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
  })

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
                <BreadcrumbPage>Mapping Table</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={handleRunMapping} disabled={running} size="sm">
            {running ? "Running…" : "Run Mapping"}
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/dashboard/migration/${params.projectId}/mapping/canvas`}>
              Canvas View
            </Link>
          </Button>
          <div className="ml-auto flex gap-2">
            <Select
              value={confidenceFilter ?? "all"}
              onValueChange={(v) => setConfidenceFilter(v === "all" ? null : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Confidence" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Confidence</SelectItem>
                <SelectItem value="High">High</SelectItem>
                <SelectItem value="Medium">Medium</SelectItem>
                <SelectItem value="Low">Low</SelectItem>
                <SelectItem value="None">None</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={categoryFilter ?? "all"}
              onValueChange={(v) => setCategoryFilter(v === "all" ? null : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {loading ? (
          <Skeleton className="h-64 w-full rounded-xl" />
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((hg) => (
                  <TableRow key={hg.id}>
                    {hg.headers.map((header) => (
                      <TableHead key={header.id}>
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="text-center text-muted-foreground py-8">
                      No mapping results. Import resources and run mapping first.
                    </TableCell>
                  </TableRow>
                ) : (
                  table.getRowModel().rows.map((row) => {
                    const rowKey = `${row.original.name}-${row.original.awsService}`
                    const isExpanded = expandedId === rowKey
                    return (
                      <>
                        <TableRow
                          key={row.id}
                          className="cursor-pointer"
                          onClick={() => setExpandedId(isExpanded ? null : rowKey)}
                        >
                          {row.getVisibleCells().map((cell) => (
                            <TableCell key={cell.id}>
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </TableCell>
                          ))}
                        </TableRow>
                        {isExpanded && (
                          <TableRow key={`${row.id}-detail`}>
                            <TableCell colSpan={columns.length} className="bg-muted/30 p-4">
                              <div className="grid gap-2 text-sm">
                                <div>
                                  <span className="font-medium">Migration Notes: </span>
                                  {row.original.migrationNotes || "—"}
                                </div>
                                <div>
                                  <span className="font-medium">Alternatives: </span>
                                  {(() => {
                                    try {
                                      const alts = JSON.parse(row.original.alternatives)
                                      return Array.isArray(alts) && alts.length > 0
                                        ? alts.join(", ")
                                        : "—"
                                    } catch {
                                      return "—"
                                    }
                                  })()}
                                </div>
                                <div>
                                  <span className="font-medium">Full Rationale: </span>
                                  {row.original.rationale || "—"}
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </>
  )
}
