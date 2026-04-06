"use client"

import * as React from "react"
import { useState, useEffect, useCallback } from "react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

// Chart colors — use var() directly (oklch values), NOT wrapped in hsl()
const CHART_COLORS = {
  history: "var(--chart-1)",
  forecast: "var(--chart-3)",
  grid: "var(--border)",
} as const

type ForecastMetric = "spend" | "security_score" | "finding_count"

interface ForecastDataPoint {
  date: string
  value: number
}

interface ForecastResponse {
  history: ForecastDataPoint[]
  forecast: ForecastDataPoint[]
  trend: string
  changePercent: number
  message?: string
}

interface ForecastChartProps {
  accountId: string
  defaultMetric?: ForecastMetric
}

const metricLabels: Record<ForecastMetric, string> = {
  spend: "Monthly Spend",
  security_score: "Security Score",
  finding_count: "Finding Count",
}

const horizonOptions = [
  { value: 7, label: "7d" },
  { value: 30, label: "30d" },
  { value: 90, label: "90d" },
]

export function ForecastChart({
  accountId,
  defaultMetric = "spend",
}: ForecastChartProps) {
  const [metric, setMetric] = useState<ForecastMetric>(defaultMetric)
  const [horizon, setHorizon] = useState(30)
  const [data, setData] = useState<ForecastResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [aiNarrative, setAiNarrative] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)

  const fetchForecast = useCallback(async () => {
    setLoading(true)
    setAiNarrative(null)
    try {
      const res = await fetch(
        `/api/insights/forecast?accountId=${accountId}&metric=${metric}&horizon=${horizon}`,
      )
      if (!res.ok) return
      const json = await res.json()
      setData(json)
    } catch {
      // Silently fail
    } finally {
      setLoading(false)
    }
  }, [accountId, metric, horizon])

  useEffect(() => {
    fetchForecast()
  }, [fetchForecast])

  const handleAskAi = async () => {
    if (!data || aiLoading) return
    setAiLoading(true)
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `Analyze this ${metricLabels[metric]} forecast trend in 2-3 sentences. History: ${JSON.stringify(data.history.slice(-5))}. Forecast: ${JSON.stringify(data.forecast.slice(0, 5))}. Trend: ${data.trend}, change: ${data.changePercent}%.`,
          mode: "insights",
        }),
      })
      if (!res.ok) throw new Error("Failed")

      // Read SSE stream
      const reader = res.body?.getReader()
      if (!reader) return
      const decoder = new TextDecoder()
      let text = ""
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          try {
            const parsed = JSON.parse(line.slice(6))
            if (parsed.type === "delta" && parsed.content) {
              text += parsed.content
              setAiNarrative(text)
            }
          } catch {
            // skip
          }
        }
      }
    } catch {
      setAiNarrative("Unable to generate AI analysis at this time.")
    } finally {
      setAiLoading(false)
    }
  }

  // Build chart data: merge history + forecast
  const chartData = React.useMemo(() => {
    if (!data) return []
    const historyPoints = data.history.map((p) => ({
      date: p.date,
      history: p.value,
      forecast: undefined as number | undefined,
    }))
    // Bridge: last history point also appears as first forecast point
    const forecastPoints = data.forecast.map((p) => ({
      date: p.date,
      history: undefined as number | undefined,
      forecast: p.value,
    }))
    if (historyPoints.length > 0 && forecastPoints.length > 0) {
      const last = historyPoints[historyPoints.length - 1]
      forecastPoints.unshift({
        date: last.date,
        history: undefined,
        forecast: last.history,
      })
    }
    return [...historyPoints, ...forecastPoints]
  }, [data])

  const hasMessage = data?.message

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Forecast</CardTitle>
          <div className="flex gap-1">
            {horizonOptions.map((h) => (
              <button
                key={h.value}
                type="button"
                className={`rounded px-2 py-0.5 text-xs ${
                  horizon === h.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setHorizon(h.value)}
              >
                {h.label}
              </button>
            ))}
          </div>
        </div>
        {/* Metric selector */}
        <div className="flex gap-0.5 rounded-md bg-muted p-0.5">
          {(Object.keys(metricLabels) as ForecastMetric[]).map((m) => (
            <button
              key={m}
              type="button"
              className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                metric === m
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setMetric(m)}
            >
              {metricLabels[m]}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex h-48 items-center justify-center text-xs text-muted-foreground">
            Loading forecast…
          </div>
        ) : hasMessage ? (
          <div className="flex h-48 items-center justify-center text-xs text-muted-foreground">
            {data.message}
          </div>
        ) : chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10 }}
                tickFormatter={(v) => {
                  const d = new Date(v)
                  return `${d.getMonth() + 1}/${d.getDate()}`
                }}
              />
              <YAxis
                tick={{ fontSize: 10 }}
                width={50}
                tickFormatter={(v) =>
                  metric === "spend" ? `$${Number(v).toLocaleString()}` : String(Math.round(v))
                }
              />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
                labelFormatter={(v) => new Date(v).toLocaleDateString()}
                formatter={(value, name) => {
                  const num = Number(value ?? 0)
                  const formatted =
                    metric === "spend"
                      ? `$${num.toFixed(2)}`
                      : String(Math.round(num))
                  return [formatted, name]
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line
                type="monotone"
                dataKey="history"
                stroke={CHART_COLORS.history}
                strokeWidth={2}
                dot={{ r: 3, fill: CHART_COLORS.history }}
                activeDot={{ r: 5 }}
                name="Historical"
                connectNulls={false}
              />
              <Line
                type="monotone"
                dataKey="forecast"
                stroke={CHART_COLORS.forecast}
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ r: 3, fill: CHART_COLORS.forecast }}
                activeDot={{ r: 5 }}
                name="Forecast"
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-48 items-center justify-center text-xs text-muted-foreground">
            No data available
          </div>
        )}

        {/* Ask AI button + narrative */}
        {data && !hasMessage && (
          <div className="mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleAskAi}
              disabled={aiLoading}
              className="text-xs"
            >
              {aiLoading ? "Analyzing…" : "Ask AI"}
            </Button>
            {aiNarrative && (
              <div className="mt-2 rounded-md bg-muted p-2 text-xs text-muted-foreground">
                {aiNarrative}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
