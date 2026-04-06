"use client"

import * as React from "react"
import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface CorrelatedResource {
  resourceId: string
  resourceName: string
  service: string
  cfmRecommendation: {
    priority: string
    currentCost: number
    estimatedSavings: number
  }
  cspFindings: Array<{
    severity: string
    finding: string
    cisReference: string | null
    category: string
  }>
}

interface CorrelationTableProps {
  accountId: string
}

const severityWeight: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
}

const severityVariant: Record<string, "destructive" | "default" | "secondary" | "outline"> = {
  critical: "destructive",
  high: "destructive",
  medium: "default",
  low: "secondary",
}

function combinedScore(corr: CorrelatedResource): number {
  const maxSeverity = Math.max(
    ...corr.cspFindings.map((f) => severityWeight[f.severity] ?? 0),
  )
  return corr.cfmRecommendation.estimatedSavings * maxSeverity
}

export function CorrelationTable({ accountId }: CorrelationTableProps) {
  const [correlations, setCorrelations] = useState<CorrelatedResource[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const fetchCorrelations = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/insights/correlations?accountId=${accountId}`,
      )
      if (!res.ok) return
      const json = await res.json()
      const sorted = (json.correlations ?? []).sort(
        (a: CorrelatedResource, b: CorrelatedResource) =>
          combinedScore(b) - combinedScore(a),
      )
      setCorrelations(sorted)
    } catch {
      // Silently fail
    } finally {
      setLoading(false)
    }
  }, [accountId])

  useEffect(() => {
    fetchCorrelations()
  }, [fetchCorrelations])

  const maxSeverityLabel = (corr: CorrelatedResource) => {
    const severities = corr.cspFindings.map((f) => f.severity)
    if (severities.includes("critical")) return "critical"
    if (severities.includes("high")) return "high"
    if (severities.includes("medium")) return "medium"
    return "low"
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Cross-Domain Insights</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-24 items-center justify-center text-xs text-muted-foreground">
            Loading correlations…
          </div>
        </CardContent>
      </Card>
    )
  }

  if (correlations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Cross-Domain Insights</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-24 items-center justify-center text-xs text-muted-foreground">
            No cross-domain insights yet
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Cross-Domain Insights</CardTitle>
          <span className="text-xs text-muted-foreground">
            {correlations.length} correlated resource{correlations.length !== 1 ? "s" : ""}
          </span>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {correlations.map((corr) => {
            const isExpanded = expandedId === corr.resourceId
            const severity = maxSeverityLabel(corr)

            return (
              <div key={corr.resourceId}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/50"
                  onClick={() =>
                    setExpandedId(isExpanded ? null : corr.resourceId)
                  }
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-xs font-medium">
                        {corr.resourceName}
                      </span>
                      <Badge variant="outline" className="shrink-0 text-[10px]">
                        {corr.service}
                      </Badge>
                    </div>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    ${corr.cfmRecommendation.estimatedSavings.toFixed(0)}/mo
                  </span>
                  <Badge
                    variant={severityVariant[severity] ?? "secondary"}
                    className="shrink-0 text-[10px]"
                  >
                    {severity}
                  </Badge>
                </button>

                {isExpanded && (
                  <div className="border-t bg-muted/30 px-4 py-3 space-y-2">
                    <div>
                      <span className="text-[10px] font-medium uppercase text-muted-foreground">
                        Cost Recommendation
                      </span>
                      <p className="text-xs mt-0.5">
                        Priority: {corr.cfmRecommendation.priority} · Current cost: $
                        {corr.cfmRecommendation.currentCost.toFixed(2)} · Savings: $
                        {corr.cfmRecommendation.estimatedSavings.toFixed(2)}/mo
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] font-medium uppercase text-muted-foreground">
                        Security Findings ({corr.cspFindings.length})
                      </span>
                      {corr.cspFindings.map((f, i) => (
                        <div key={i} className="mt-1 text-xs">
                          <Badge
                            variant={severityVariant[f.severity] ?? "secondary"}
                            className="mr-1 text-[10px]"
                          >
                            {f.severity}
                          </Badge>
                          {f.finding}
                          {f.cisReference && (
                            <span className="ml-1 text-muted-foreground">
                              (CIS {f.cisReference})
                            </span>
                          )}
                          <span className="ml-1 text-muted-foreground">
                            [{f.category}]
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
