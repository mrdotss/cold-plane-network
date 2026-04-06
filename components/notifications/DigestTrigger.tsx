"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { HugeiconsIcon } from "@hugeicons/react"
import { Notification01Icon } from "@hugeicons/core-free-icons"

export function DigestTrigger() {
  const [loading, setLoading] = useState(false)
  const [lastDigestDate, setLastDigestDate] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch last digest date on mount
  useEffect(() => {
    async function fetchLastDigest() {
      try {
        const res = await fetch("/api/notifications?limit=1&unreadOnly=false")
        if (!res.ok) return
        const data = await res.json()
        const digest = data.notifications?.find(
          (n: { type: string }) => n.type === "digest_summary",
        )
        if (digest) {
          setLastDigestDate(digest.createdAt)
        }
      } catch {
        // Silently fail
      }
    }
    fetchLastDigest()
  }, [])

  const handleGenerate = async () => {
    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const res = await fetch("/api/notifications/digest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to generate digest")
      }

      setSuccess(true)
      setLastDigestDate(new Date().toISOString())

      // Clear success indicator after 3 seconds
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate digest")
    } finally {
      setLoading(false)
    }
  }

  const formattedDate = lastDigestDate
    ? new Date(lastDigestDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null

  return (
    <div className="flex items-center gap-3">
      <Button
        variant="outline"
        size="sm"
        onClick={handleGenerate}
        disabled={loading}
        className="gap-1.5"
      >
        <HugeiconsIcon
          icon={Notification01Icon}
          strokeWidth={2}
          className="size-3.5"
        />
        {loading ? "Generating…" : success ? "Digest Created" : "Generate Digest"}
      </Button>
      {formattedDate && (
        <span className="text-xs text-muted-foreground">
          Last digest: {formattedDate}
        </span>
      )}
      {error && (
        <span className="text-xs text-destructive">{error}</span>
      )}
    </div>
  )
}
