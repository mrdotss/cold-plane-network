"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
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
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

interface RelStats {
  total: number
  byType: Record<string, number>
  byMethod: Record<string, number>
  byConfidence: Record<string, number>
}

const METHOD_LABELS: Record<string, string> = {
  arm_hierarchy: "ARM hierarchy",
  property_ref: "Property refs",
  name_heuristic: "Name heuristics",
  rg_heuristic: "RG co-location",
}

export default function ImportPage() {
  const params = useParams<{ projectId: string }>()
  const [jsonText, setJsonText] = useState("")
  const [manualName, setManualName] = useState("")
  const [manualType, setManualType] = useState("")
  const [manualKind, setManualKind] = useState("")
  const [manualLocation, setManualLocation] = useState("")
  const [manualSku, setManualSku] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [relStats, setRelStats] = useState<RelStats | null>(null)

  async function extractRelationships(projectId: string): Promise<RelStats | null> {
    try {
      const res = await fetch(`/api/projects/${projectId}/relationships`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
      if (!res.ok) return null
      const json = await res.json()
      const stats = json.stats as RelStats | undefined
      return stats ?? null
    } catch {
      return null
    }
  }

  async function importJson(data: unknown) {
    setError(null)
    setSuccess(null)
    setRelStats(null)
    setSubmitting(true)
    try {
      const res = await fetch(`/api/projects/${params.projectId}/resources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "json", data }),
      })
      const json = await res.json()
      if (!res.ok) {
        const msg = json.issues
          ? json.issues.map((i: { message: string }) => i.message).join(", ")
          : json.error
        setError(msg ?? "Import failed")
        return
      }
      const count = json.data.count
      const relResult = await extractRelationships(params.projectId)
      setRelStats(relResult)
      if (relResult) {
        setSuccess(`Imported ${count} resources, found ${relResult.total} relationships`)
      } else {
        setSuccess(`Imported ${count} resources (relationship extraction failed)`)
      }
      setJsonText("")
    } catch {
      setError("Import failed")
    } finally {
      setSubmitting(false)
    }
  }

  async function handlePaste(e: React.FormEvent) {
    e.preventDefault()
    try {
      const parsed = JSON.parse(jsonText)
      await importJson(parsed)
    } catch {
      setError("Invalid JSON: unable to parse input")
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      setError("File too large. Maximum size is 10MB.")
      return
    }
    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      await importJson(parsed)
    } catch {
      setError("Invalid JSON file")
    }
    e.target.value = ""
  }

  async function handleManual(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setRelStats(null)
    setSubmitting(true)
    try {
      const res = await fetch(`/api/projects/${params.projectId}/resources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "manual",
          name: manualName,
          type: manualType,
          kind: manualKind || undefined,
          location: manualLocation || undefined,
          sku: manualSku || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        const msg = json.issues
          ? json.issues.map((i: { message: string }) => i.message).join(", ")
          : json.error
        setError(msg ?? "Import failed")
        return
      }
      const relResult = await extractRelationships(params.projectId)
      setRelStats(relResult)
      if (relResult) {
        setSuccess(`Resource added, found ${relResult.total} relationships`)
      } else {
        setSuccess("Resource added (relationship extraction failed)")
      }
      setManualName("")
      setManualType("")
      setManualKind("")
      setManualLocation("")
      setManualSku("")
    } catch {
      setError("Import failed")
    } finally {
      setSubmitting(false)
    }
  }

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
                <BreadcrumbPage>Import</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0 max-w-2xl">
        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-lg border border-green-500/50 bg-green-500/10 p-3 text-sm text-green-700 dark:text-green-400">
            <p>{success}</p>
            {relStats && relStats.total > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                {Object.entries(relStats.byType).map(([type, count]) => (
                  <Badge key={type} variant="outline" className="text-[10px]">
                    {type}: {count}
                  </Badge>
                ))}
                <span className="text-muted-foreground">·</span>
                {Object.entries(relStats.byMethod).map(([method, count]) => (
                  <Badge key={method} variant="secondary" className="text-[10px]">
                    {METHOD_LABELS[method] ?? method}: {count}
                  </Badge>
                ))}
              </div>
            )}
            <div className="mt-2">
              <Button variant="outline" size="sm" asChild>
                <Link href={`/dashboard/migration/${params.projectId}/mapping/canvas`}>
                  View Topology Canvas
                </Link>
              </Button>
            </div>
          </div>
        )}

        <Tabs defaultValue="paste">
          <TabsList>
            <TabsTrigger value="paste">Paste JSON</TabsTrigger>
            <TabsTrigger value="upload">Upload File</TabsTrigger>
            <TabsTrigger value="manual">Manual Entry</TabsTrigger>
          </TabsList>

          <TabsContent value="paste">
            <Card>
              <CardHeader>
                <CardTitle>Paste Azure Resource Graph JSON</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handlePaste} className="grid gap-4">
                  <Textarea
                    value={jsonText}
                    onChange={(e) => setJsonText(e.target.value)}
                    placeholder='[{"name": "my-vm", "type": "microsoft.compute/virtualmachines", ...}]'
                    rows={10}
                    className="font-mono text-xs"
                  />
                  <Button type="submit" disabled={submitting || !jsonText.trim()}>
                    {submitting ? "Importing…" : "Import"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="upload">
            <Card>
              <CardHeader>
                <CardTitle>Upload JSON File</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  <Label htmlFor="file-upload">Select a .json file (max 10MB)</Label>
                  <Input
                    id="file-upload"
                    type="file"
                    accept=".json"
                    onChange={handleFileUpload}
                    disabled={submitting}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="manual">
            <Card>
              <CardHeader>
                <CardTitle>Manual Resource Entry</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleManual} className="grid gap-4">
                  <div className="grid gap-1.5">
                    <Label htmlFor="m-name">Name *</Label>
                    <Input
                      id="m-name"
                      value={manualName}
                      onChange={(e) => setManualName(e.target.value)}
                      placeholder="e.g. my-vm"
                      required
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="m-type">Type *</Label>
                    <Input
                      id="m-type"
                      value={manualType}
                      onChange={(e) => setManualType(e.target.value)}
                      placeholder="e.g. microsoft.compute/virtualmachines"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="grid gap-1.5">
                      <Label htmlFor="m-kind">Kind</Label>
                      <Input
                        id="m-kind"
                        value={manualKind}
                        onChange={(e) => setManualKind(e.target.value)}
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="m-location">Location</Label>
                      <Input
                        id="m-location"
                        value={manualLocation}
                        onChange={(e) => setManualLocation(e.target.value)}
                        placeholder="e.g. eastus"
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="m-sku">SKU</Label>
                      <Input
                        id="m-sku"
                        value={manualSku}
                        onChange={(e) => setManualSku(e.target.value)}
                      />
                    </div>
                  </div>
                  <Button type="submit" disabled={submitting || !manualName.trim() || !manualType.trim()}>
                    {submitting ? "Adding…" : "Add Resource"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  )
}
