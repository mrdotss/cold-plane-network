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
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

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

  async function importJson(data: unknown) {
    setError(null)
    setSuccess(null)
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
      setSuccess(`Imported ${json.data.count} resources`)
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
      setSuccess("Resource added")
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
            {success}
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
