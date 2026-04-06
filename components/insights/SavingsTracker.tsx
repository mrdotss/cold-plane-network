"use client"

import * as React from "react"
import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface SavingsTrackerItem {
  trackingId: string
  accountId: string
  resourceId: string
  service: string
  expectedSavings: number
  actualSavings: number | null
  verificationStatus: string
  implementedAt: string | null
  verifiedAt: string | null
}

interface SavingsTrackerResponse {
  tracked: SavingsTrackerItem[]
  summary: {
    totalExpectedSavings: number
    totalActualSavings: number
  }
}

const statusConfig: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  confirmed: { label: "Confirmed", variant: "default" },
  partial: { label: "Partial", variant: "secondary" },
  not_realized: { label: "Not Realized", variant: "destructive" },
  pending: { label: "Pending Verification", variant: "outline" },
}

export function SavingsTracker() {
  const [data, setData] = useState<SavingsTrackerResponse | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/insights/savings-tracker")
      if (!res.ok) return
      const json = await res.json()
      setData(json)
    } catch {
      // Silently fail
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Savings Tracker</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-24 items-center justify-center text-xs text-muted-foreground">
            Loading savings data…
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!data || data.tracked.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Savings Tracker</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-24 items-center justify-center text-xs text-muted-foreground">
            No recommendations have been implemented yet
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Savings Tracker</CardTitle>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">
              ${data.summary.totalActualSavings.toFixed(0)} / $
              {data.summary.totalExpectedSavings.toFixed(0)} verified
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {data.tracked.map((item) => {
            const config = statusConfig[item.verificationStatus] ?? statusConfig.pending

            return (
              <div
                key={item.trackingId}
                className="flex items-center gap-3 px-4 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-xs font-medium">
                      {item.resourceId}
                    </span>
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      {item.service}
                    </Badge>
                  </div>
                  <div className="mt-0.5 text-[10px] text-muted-foreground">
                    Expected: ${item.expectedSavings.toFixed(2)}/mo
                    {item.actualSavings != null && (
                      <> · Actual: ${item.actualSavings.toFixed(2)}/mo</>
                    )}
                  </div>
                </div>
                <Badge variant={config.variant} className="shrink-0 text-[10px]">
                  {config.label}
                </Badge>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
