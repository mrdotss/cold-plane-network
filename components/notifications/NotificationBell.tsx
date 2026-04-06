"use client"

import * as React from "react"
import { useState, useEffect, useCallback } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Notification03Icon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { NotificationCenter } from "./NotificationCenter"

const POLL_INTERVAL_MS = 30_000

export function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Defer interactive rendering until after hydration to prevent
  // Radix Popover aria-controls ID mismatch between server and client
  useEffect(() => {
    setMounted(true)
  }, [])

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?unreadOnly=true&limit=1")
      if (!res.ok) return
      const data = await res.json()
      setUnreadCount((prev) => {
        // Only update if changed to avoid unnecessary re-renders
        if (prev === data.unreadCount) return prev
        return data.unreadCount
      })
    } catch {
      // Silently retry on next interval
    }
  }, [])

  useEffect(() => {
    fetchUnreadCount()
    const interval = setInterval(fetchUnreadCount, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [fetchUnreadCount])

  // Refresh count when popover closes (user may have marked items as read)
  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen) {
      fetchUnreadCount()
    }
  }

  // Render a static placeholder button during SSR / before hydration
  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="relative size-8"
        aria-label="Notifications"
      >
        <HugeiconsIcon
          icon={Notification03Icon}
          strokeWidth={2}
          className="size-4"
        />
      </Button>
    )
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative size-8"
          aria-label={
            unreadCount > 0
              ? `${unreadCount} unread notifications`
              : "Notifications"
          }
        >
          <HugeiconsIcon
            icon={Notification03Icon}
            strokeWidth={2}
            className="size-4"
          />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={8} className="w-72 p-0">
        <NotificationCenter
          onCountChange={setUnreadCount}
          onClose={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  )
}
