"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
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
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

interface Project {
  id: string
  name: string
  customerName: string
  notes: string
  createdAt: string
  updatedAt: string
  _count: { resources: number }
}

interface MappingResource {
  id: string
  recommendations: { id: string }[]
}

export default function ProjectDetailPage() {
  const params = useParams<{ projectId: string }>()
  const router = useRouter()
  const [project, setProject] = useState<Project | null>(null)
  const [mappingCount, setMappingCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const [projRes, mapRes] = await Promise.all([
          fetch("/api/projects"),
          fetch(`/api/projects/${params.projectId}/mapping`),
        ])
        const projJson = await projRes.json()
        const mapJson = await mapRes.json()

        const found = (projJson.data as Project[])?.find(
          (p) => p.id === params.projectId
        )
        if (!found) {
          setError("Project not found")
          return
        }
        setProject(found)

        if (mapJson.data) {
          const withRecs = (mapJson.data as MappingResource[]).filter(
            (r) => r.recommendations.length > 0
          )
          setMappingCount(withRecs.length)
        }
      } catch {
        setError("Failed to load project")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [params.projectId])

  async function handleDelete() {
    setDeleting(true)
    try {
      const res = await fetch(`/api/projects/${params.projectId}`, {
        method: "DELETE",
      })
      if (res.ok) {
        router.push("/dashboard/migration")
      } else {
        setError("Failed to delete project")
      }
    } catch {
      setError("Failed to delete project")
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <>
        <header className="flex h-16 shrink-0 items-center gap-2">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 data-vertical:h-4" />
            <Skeleton className="h-4 w-40" />
          </div>
        </header>
        <div className="p-4 pt-0">
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </>
    )
  }

  if (error || !project) {
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
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        <div className="p-4 pt-0">
          <p className="text-sm text-destructive">{error ?? "Project not found"}</p>
        </div>
      </>
    )
  }

  const navLinks = [
    { label: "Import Resources", href: `/dashboard/migration/${project.id}/import` },
    { label: "Mapping Table", href: `/dashboard/migration/${project.id}/mapping` },
    { label: "Mapping Canvas", href: `/dashboard/migration/${project.id}/mapping/canvas` },
    { label: "Export Report", href: `/dashboard/migration/${project.id}/export` },
  ]

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
                <BreadcrumbPage>{project.name}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <Card>
          <CardHeader>
            <CardTitle>{project.name}</CardTitle>
            {project.customerName && (
              <CardDescription>{project.customerName}</CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 text-sm">
              {project.notes && (
                <p className="text-muted-foreground">{project.notes}</p>
              )}
              <div className="flex gap-4 text-muted-foreground">
                <span>{project._count.resources} resources</span>
                <span>{mappingCount} mapped</span>
                <span>Created {new Date(project.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {navLinks.map((link) => (
            <Button key={link.href} variant="outline" asChild className="h-auto py-3">
              <Link href={link.href}>{link.label}</Link>
            </Button>
          ))}
        </div>

        <div className="pt-4">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={deleting}>
                {deleting ? "Deleting…" : "Delete Project"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete project?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete &quot;{project.name}&quot; and all its
                  resources and mapping data. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={handleDelete}>
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </>
  )
}
