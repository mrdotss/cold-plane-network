"use client"

import * as React from "react"
import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ChartRingIcon,
  SecurityCheckIcon,
  Notification01Icon,
  Alert01Icon,
  CheckmarkCircle01Icon,
  AlertCircleIcon,
} from "@hugeicons/core-free-icons"
import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import type { IconSvgElement } from "@hugeicons/react"

interface NotificationRecord {
  id: string
  type: string
  title: string
  body: string
  metadata: Record<string, unknown>
  readAt: string | null
  createdAt: string
}

interface NotificationCenterProps {
  onCountChange: (count: number) => void
  onClose: () => void
}

const typeIcons: Record<string, IconSvgElement> = {
  cfm_scan_complete: ChartRingIcon,
  csp_scan_complete: SecurityCheckIcon,
  digest_summary: Notification01Icon,
  correlation_alert: Alert01Icon,
  savings_verified: CheckmarkCircle01Icon,
  security_regression: AlertCircleIcon,
}

function relativeTime(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  const diffMin = Math.floor(diffMs / 60_000)

  if (diffMin < 1) return "just now"
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 7) return `${diffDay}d ago`
  return new Date(dateStr).toLocaleDateString()
}

export function NotificationCenter({
  onCountChange,
  onClose,
}: NotificationCenterProps) {
  const router = useRouter()
  const [notifications, setNotifications] = useState<NotificationRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [markingAll, setMarkingAll] = useState(false)
  const [expandedDigest, setExpandedDigest] = useState<string | null>(null)

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?limit=20")
      if (!res.ok) return
      const data = await res.json()
      setNotifications(data.notifications)
      onCountChange(data.unreadCount)
    } catch {
      // Silently fail
    } finally {
      setLoading(false)
    }
  }, [onCountChange])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  const handleMarkAllRead = async () => {
    const unreadIds = notifications
      .filter((n) => !n.readAt)
      .map((n) => n.id)
    if (unreadIds.length === 0) return

    setMarkingAll(true)
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: unreadIds, action: "read" }),
      })
      // Update local state
      setNotifications((prev) =>
        prev.map((n) =>
          unreadIds.includes(n.id)
            ? { ...n, readAt: new Date().toISOString() }
            : n,
        ),
      )
      onCountChange(0)
    } catch {
      // Silently fail
    } finally {
      setMarkingAll(false)
    }
  }

  const handleClick = (notification: NotificationRecord) => {
    switch (notification.type) {
      case "csp_scan_complete":
        onClose()
        router.push("/dashboard/csp")
        break
      case "cfm_scan_complete":
        onClose()
        router.push("/dashboard/cfm")
        break
      case "digest_summary":
        setExpandedDigest(
          expandedDigest === notification.id ? null : notification.id,
        )
        break
      default:
        break
    }
  }

  const unreadCount = notifications.filter((n) => !n.readAt).length

  return (
    <div className="flex max-h-96 flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-sm font-medium">Notifications</span>
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-auto px-1.5 py-0.5 text-xs"
            onClick={handleMarkAllRead}
            disabled={markingAll}
          >
            {markingAll ? "Marking…" : "Mark all as read"}
          </Button>
        )}
      </div>
      <Separator />

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex gap-2">
                <Skeleton className="size-5 shrink-0 rounded" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="px-3 py-8 text-center text-xs text-muted-foreground">
            No notifications yet
          </div>
        ) : (
          notifications.map((n) => {
            const Icon = typeIcons[n.type] ?? Notification01Icon
            const isUnread = !n.readAt
            const isExpanded = expandedDigest === n.id

            return (
              <div key={n.id}>
                <button
                  type="button"
                  className={`relative flex w-full gap-2.5 px-4 py-2.5 text-left transition-colors hover:bg-muted/50 ${
                    isUnread ? "bg-muted/30" : ""
                  }`}
                  onClick={() => handleClick(n)}
                >
                  {isUnread && (
                    <span className="absolute left-1.5 top-1/2 -translate-y-1/2 size-1.5 rounded-full bg-primary" />
                  )}
                  <HugeiconsIcon
                    icon={Icon}
                    strokeWidth={2}
                    className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span
                        className={`truncate text-xs ${
                          isUnread ? "font-medium" : ""
                        }`}
                      >
                        {n.title}
                      </span>
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {relativeTime(n.createdAt)}
                      </span>
                    </div>
                    {isExpanded && n.type === "digest_summary" && (
                      <div className="mt-1 text-xs text-muted-foreground prose prose-xs prose-neutral dark:prose-invert max-w-none [&_h2]:text-xs [&_h2]:font-semibold [&_h2]:mt-2 [&_h3]:text-xs [&_h3]:font-medium [&_h3]:mt-1 [&_ul]:mt-0.5 [&_ul]:mb-1 [&_li]:mt-0 [&_p]:mt-0.5 [&_p]:mb-0.5">
                        <Markdown remarkPlugins={[remarkGfm]}>{n.body}</Markdown>
                      </div>
                    )}
                  </div>
                </button>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
