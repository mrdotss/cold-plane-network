"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

interface Project {
  id: string
  name: string
  customerName: string
  notes: string
  createdAt: string
  updatedAt: string
  _count: { resources: number }
}

export default function MigrationProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/projects")
      .then((res) => res.json())
      .then((json) => {
        if (json.error) setError(json.error)
        else setProjects(json.data ?? [])
      })
      .catch(() => setError("Failed to load projects"))
      .finally(() => setLoading(false))
  }, [])

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2">
        <div className="flex items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 data-vertical:h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>Migration Advisor</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-medium">Projects</h1>
          <Button asChild size="sm">
            <Link href="/dashboard/migration/new">New Project</Link>
          </Button>
        </div>

        {loading && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-3 w-20" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        {!loading && !error && projects.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground text-sm">
                No projects yet. Create one to get started.
              </p>
            </CardContent>
          </Card>
        )}

        {!loading && projects.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <Link key={project.id} href={`/dashboard/migration/${project.id}`}>
                <Card className="hover:ring-foreground/20 transition-all cursor-pointer">
                  <CardHeader>
                    <CardTitle>{project.name}</CardTitle>
                    {project.customerName && (
                      <CardDescription>{project.customerName}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{project._count.resources} resources</span>
                      <span>
                        {new Date(project.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
