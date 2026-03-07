"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface SizingReport {
  id: string;
  fileName: string;
  reportType: string;
  totalMonthly: number;
  serviceCount: number;
  region: string;
  createdAt: string;
}

/** Compute summary statistics from a list of reports. Exported for testing (Property 10). */
export function computeSummaryStats(reports: SizingReport[]) {
  const totalCount = reports.length;

  const lastEstimate =
    reports.length > 0
      ? reports.reduce((latest, r) =>
          new Date(r.createdAt) > new Date(latest.createdAt) ? r : latest
        )
      : null;

  // Most used region: region with highest frequency
  let mostUsedRegion = "—";
  if (reports.length > 0) {
    const regionCounts: Record<string, number> = {};
    for (const r of reports) {
      if (r.region) {
        regionCounts[r.region] = (regionCounts[r.region] || 0) + 1;
      }
    }
    const entries = Object.entries(regionCounts);
    if (entries.length > 0) {
      mostUsedRegion = entries.reduce((a, b) => (b[1] > a[1] ? b : a))[0];
    }
  }

  return {
    totalCount,
    lastEstimateTotal: lastEstimate?.totalMonthly ?? 0,
    mostUsedRegion,
  };
}

export function SizingDashboard() {
  const [reports, setReports] = useState<SizingReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/sizing?limit=5")
      .then((res) => res.json())
      .then((json) => setReports(json.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const stats = computeSummaryStats(reports);

  return (
    <div className="space-y-4">
      {/* Hero info card */}
      <Card>
        <CardHeader>
          <CardTitle>Sizing Tool</CardTitle>
          <CardDescription>
            Upload AWS Pricing Calculator exports, generate formatted Excel reports, and get
            AI-powered sizing recommendations from the CPN Agent.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card size="sm">
          <CardHeader>
            <CardDescription>Total Reports</CardDescription>
            <CardTitle>{loading ? "—" : stats.totalCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>Last Estimate</CardDescription>
            <CardTitle>
              {loading ? "—" : `$${stats.lastEstimateTotal.toFixed(2)}/mo`}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>Most Used Region</CardDescription>
            <CardTitle>{loading ? "—" : stats.mostUsedRegion}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Recent reports table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Recent Reports</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-sm">Loading...</p>
          ) : reports.length === 0 ? (
            <p className="text-muted-foreground text-sm">No reports yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Monthly Total</TableHead>
                  <TableHead>Services</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.fileName}</TableCell>
                    <TableCell>{r.reportType}</TableCell>
                    <TableCell>${r.totalMonthly.toFixed(2)}</TableCell>
                    <TableCell>{r.serviceCount}</TableCell>
                    <TableCell>
                      {new Date(r.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
