"use client";

import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { ScanHistoryEntry } from "@/lib/cfm/types";

interface ScanHistoryTableProps {
  scans: ScanHistoryEntry[];
  accountId: string;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function ScanHistoryTable({ scans, accountId }: ScanHistoryTableProps) {
  if (scans.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">
        No completed scans found.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[180px]">Date</TableHead>
            <TableHead className="w-[130px] text-right">Monthly Spend</TableHead>
            <TableHead className="w-[140px] text-right">
              Potential Savings
            </TableHead>
            <TableHead className="w-[80px] text-center">Recs</TableHead>
            <TableHead className="w-[200px]">Priority</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {scans.map((scan) => {
            const s = scan.summary;
            return (
              <TableRow key={scan.id} className="group">
                <TableCell>
                  <Link
                    href={`/dashboard/cfm/${accountId}?scan=${scan.id}`}
                    className="text-xs font-medium text-foreground hover:underline"
                  >
                    {formatDate(scan.completedAt)}
                  </Link>
                </TableCell>
                <TableCell className="text-right text-xs">
                  {s ? formatCurrency(s.totalMonthlySpend) : "—"}
                </TableCell>
                <TableCell className="text-right text-xs font-medium text-green-600 dark:text-green-400">
                  {s ? formatCurrency(s.totalPotentialSavings) : "—"}
                </TableCell>
                <TableCell className="text-center text-xs">
                  {s?.recommendationCount ?? "—"}
                </TableCell>
                <TableCell>
                  {s ? (
                    <div className="flex gap-1">
                      {s.priorityBreakdown.critical > 0 && (
                        <Badge variant="destructive" className="text-[10px] px-1.5 h-4">
                          {s.priorityBreakdown.critical} Critical
                        </Badge>
                      )}
                      {s.priorityBreakdown.medium > 0 && (
                        <Badge
                          variant="outline"
                          className="border-amber-500/50 text-amber-600 dark:text-amber-400 text-[10px] px-1.5 h-4"
                        >
                          {s.priorityBreakdown.medium} Medium
                        </Badge>
                      )}
                      {s.priorityBreakdown.low > 0 && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 h-4">
                          {s.priorityBreakdown.low} Low
                        </Badge>
                      )}
                    </div>
                  ) : (
                    "—"
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
