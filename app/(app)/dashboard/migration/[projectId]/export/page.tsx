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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

export default function ExportPage() {
  const params = useParams<{ projectId: string }>()
  const [format, setFormat] = useState<"markdown" | "csv">("markdown")
  const [preview, setPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function generateReport(fmt: "markdown" | "csv") {
    setLoading(true)
    setError(null)
    setPreview(null)
    try {
      const res = await fetch(`/api/projects/${params.projectId}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format: fmt }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? "Export failed")
        return
      }
      setPreview(json.data.content)
      setFormat(fmt)
    } catch {
      setError("Export failed")
    } finally {
      setLoading(false)
    }
  }

  function handleDownload() {
    if (!preview) return
    const ext = format === "markdown" ? "md" : "csv"
    const mime = format === "markdown" ? "text/markdown" : "text/csv"
    const blob = new Blob([preview], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `migration-report.${ext}`
    a.click()
    URL.revokeObjectURL(url)
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
                <BreadcrumbPage>Export</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0 max-w-4xl">
        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <Tabs
          value={format}
          onValueChange={(v) => setFormat(v as "markdown" | "csv")}
        >
          <div className="flex items-center gap-2">
            <TabsList>
              <TabsTrigger value="markdown">Markdown</TabsTrigger>
              <TabsTrigger value="csv">CSV</TabsTrigger>
            </TabsList>
            <Button
              size="sm"
              onClick={() => generateReport(format)}
              disabled={loading}
            >
              {loading ? "Generating…" : "Generate"}
            </Button>
            {preview && (
              <Button size="sm" variant="outline" onClick={handleDownload}>
                Download
              </Button>
            )}
          </div>

          <TabsContent value="markdown">
            <Card>
              <CardHeader>
                <CardTitle>Markdown Report</CardTitle>
              </CardHeader>
              <CardContent>
                {preview && format === "markdown" ? (
                  <pre className="whitespace-pre-wrap text-xs font-mono bg-muted/50 rounded-lg p-4 max-h-[500px] overflow-auto">
                    {preview}
                  </pre>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Click Generate to preview the Markdown report.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="csv">
            <Card>
              <CardHeader>
                <CardTitle>CSV Report</CardTitle>
              </CardHeader>
              <CardContent>
                {preview && format === "csv" ? (
                  <pre className="whitespace-pre-wrap text-xs font-mono bg-muted/50 rounded-lg p-4 max-h-[500px] overflow-auto">
                    {preview}
                  </pre>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Click Generate to preview the CSV report.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  )
}
