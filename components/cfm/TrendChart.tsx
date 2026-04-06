"use client";

import { useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TrendDataPoint } from "@/lib/cfm/types";

interface TrendChartProps {
  data: TrendDataPoint[];
}

type MetricView = "spend" | "savings" | "recommendations";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border bg-background px-3 py-2 shadow-md">
      <p className="text-xs font-medium text-muted-foreground mb-1">
        {new Date(label).toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        })}
      </p>
      {payload.map((entry: { name: string; value: number; color: string }) => (
        <p key={entry.name} className="text-xs" style={{ color: entry.color }}>
          {entry.name}:{" "}
          {entry.name === "Recommendations"
            ? entry.value
            : formatCurrency(entry.value)}
        </p>
      ))}
    </div>
  );
}

export function TrendChart({ data }: TrendChartProps) {
  const [view, setView] = useState<MetricView>("spend");

  if (data.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <p className="text-sm text-muted-foreground">
            Not enough data to show trends. Run at least 2 scans to see
            historical data.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">
            Cost Trends
          </CardTitle>
          <Tabs
            value={view}
            onValueChange={(v) => setView(v as MetricView)}
          >
            <TabsList>
              <TabsTrigger value="spend">Spend</TabsTrigger>
              <TabsTrigger value="savings">Savings</TabsTrigger>
              <TabsTrigger value="recommendations">Count</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                stroke="var(--border)"
              />
              {view === "recommendations" ? (
                <YAxis
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  stroke="var(--border)"
                />
              ) : (
                <YAxis
                  tickFormatter={(v) => formatCurrency(v)}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  stroke="var(--border)"
                />
              )}
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 12, color: "var(--muted-foreground)" }}
                iconType="circle"
                iconSize={8}
              />

              {view === "spend" && (
                <>
                  <Line
                    type="monotone"
                    dataKey="totalMonthlySpend"
                    name="Monthly Spend"
                    stroke="var(--chart-1)"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="totalPotentialSavings"
                    name="Potential Savings"
                    stroke="var(--chart-2)"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                    strokeDasharray="5 5"
                  />
                </>
              )}

              {view === "savings" && (
                <Line
                  type="monotone"
                  dataKey="totalPotentialSavings"
                  name="Potential Savings"
                  stroke="var(--chart-2)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              )}

              {view === "recommendations" && (
                <Line
                  type="monotone"
                  dataKey="recommendationCount"
                  name="Recommendations"
                  stroke="var(--chart-5)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
