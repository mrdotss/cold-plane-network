"use client";

import { useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CommitmentComparison } from "@/components/cfm/CommitmentComparison";
import { CfmChatPanel } from "@/components/cfm/CfmChatPanel";
import type { CfmRecommendation, CfmPriority, CfmEffort } from "@/lib/cfm/types";

interface ServiceDeepDiveProps {
  accountId: string;
  accountName: string;
  awsAccountId: string;
  service: string;
  regions: string[];
  scanId: string;
  azureConversationId: string | null;
  recommendations: CfmRecommendation[];
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function PriorityBadge({ priority }: { priority: CfmPriority }) {
  switch (priority) {
    case "critical":
      return <Badge variant="destructive">Critical</Badge>;
    case "medium":
      return (
        <Badge variant="outline" className="border-amber-500/50 text-amber-600 dark:text-amber-400">
          Medium
        </Badge>
      );
    case "low":
      return <Badge variant="secondary">Low</Badge>;
  }
}

function EffortBadge({ effort }: { effort: CfmEffort }) {
  switch (effort) {
    case "low":
      return <Badge variant="secondary">Low</Badge>;
    case "medium":
      return (
        <Badge variant="outline" className="border-amber-500/50 text-amber-600 dark:text-amber-400">
          Medium
        </Badge>
      );
    case "high":
      return <Badge variant="destructive">High</Badge>;
  }
}

// ─── Service-specific column definitions ─────────────────────────────────────

interface ColumnDef {
  header: string;
  className?: string;
  render: (rec: CfmRecommendation) => React.ReactNode;
}

function getMeta(rec: CfmRecommendation, key: string): string {
  const val = rec.metadata?.[key];
  return val != null ? String(val) : "—";
}

function getServiceColumns(service: string): ColumnDef[] {
  const upper = service.toUpperCase();

  if (upper === "EC2") {
    return [
      {
        header: "Instance ID",
        render: (r) => <code className="text-xs font-mono">{r.resourceId}</code>,
      },
      { header: "Current Type", render: (r) => getMeta(r, "currentType") },
      { header: "Recommended Type", render: (r) => getMeta(r, "recommendedType") },
      {
        header: "Avg CPU",
        className: "text-right",
        render: (r) => {
          const cpu = r.metadata?.avgCpu;
          return cpu != null ? `${Number(cpu).toFixed(1)}%` : "—";
        },
      },
      {
        header: "Monthly Savings",
        className: "text-right",
        render: (r) => <span className="font-medium">{formatCurrency(r.estimatedSavings)}</span>,
      },
    ];
  }

  if (upper === "RDS") {
    return [
      {
        header: "DB Instance",
        render: (r) => (
          <div className="flex flex-col">
            <code className="text-xs font-mono">{r.resourceId}</code>
            {r.resourceName && <span className="text-xs text-muted-foreground">{r.resourceName}</span>}
          </div>
        ),
      },
      { header: "Status", render: (r) => getMeta(r, "status") },
      {
        header: "Recommendation",
        className: "max-w-[250px]",
        render: (r) => <span className="text-xs">{r.recommendation}</span>,
      },
      {
        header: "Connections (30d)",
        className: "text-right",
        render: (r) => getMeta(r, "connections"),
      },
      {
        header: "Monthly Savings",
        className: "text-right",
        render: (r) => <span className="font-medium">{formatCurrency(r.estimatedSavings)}</span>,
      },
    ];
  }

  if (upper === "S3") {
    return [
      {
        header: "Bucket Name",
        render: (r) => <code className="text-xs font-mono">{r.resourceId}</code>,
      },
      { header: "Current Class", render: (r) => getMeta(r, "currentClass") },
      { header: "Recommended Class", render: (r) => getMeta(r, "recommendedClass") },
      { header: "Access Pattern", render: (r) => getMeta(r, "accessPattern") },
      {
        header: "Monthly Savings",
        className: "text-right",
        render: (r) => <span className="font-medium">{formatCurrency(r.estimatedSavings)}</span>,
      },
    ];
  }

  // Fallback: generic columns for other services
  return [
    {
      header: "Resource",
      render: (r) => (
        <div className="flex flex-col">
          <code className="text-xs font-mono">{r.resourceId}</code>
          {r.resourceName && <span className="text-xs text-muted-foreground">{r.resourceName}</span>}
        </div>
      ),
    },
    { header: "Priority", render: (r) => <PriorityBadge priority={r.priority} /> },
    {
      header: "Recommendation",
      className: "max-w-[300px]",
      render: (r) => <span className="text-xs">{r.recommendation}</span>,
    },
    {
      header: "Monthly Savings",
      className: "text-right",
      render: (r) => <span className="font-medium">{formatCurrency(r.estimatedSavings)}</span>,
    },
    { header: "Effort", render: (r) => <EffortBadge effort={r.effort} /> },
  ];
}

// ─── Service recommendations table ──────────────────────────────────────────

function ServiceRecommendationsTable({
  service,
  recommendations,
}: {
  service: string;
  recommendations: CfmRecommendation[];
}) {
  const columns = useMemo(() => getServiceColumns(service), [service]);

  if (recommendations.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        No recommendations found for {service}.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {columns.map((col) => (
            <TableHead key={col.header} className={col.className}>
              {col.header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {recommendations.map((rec) => (
          <TableRow
            key={rec.id}
            className={rec.priority === "critical" ? "bg-red-50 dark:bg-red-950/20" : undefined}
          >
            {columns.map((col) => (
              <TableCell key={col.header} className={col.className}>
                {col.render(rec)}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

const COMMITMENT_SERVICES = new Set(["EC2", "RDS"]);

export function ServiceDeepDive({
  accountId: _accountId,
  accountName,
  awsAccountId,
  service,
  regions,
  scanId,
  azureConversationId,
  recommendations,
}: ServiceDeepDiveProps) {
  void _accountId;
  const totalSavings = useMemo(
    () => recommendations.reduce((sum, r) => sum + r.estimatedSavings, 0),
    [recommendations],
  );

  const showCommitment = COMMITMENT_SERVICES.has(service.toUpperCase());

  return (
    <div className="flex gap-4 h-full">
      {/* Main content — left column */}
      <div className="flex-1 min-w-0 flex flex-col gap-4 overflow-y-auto">
        {/* Service header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-medium">{service}</h2>
            <span className="text-xs text-muted-foreground">
              {recommendations.length} recommendation{recommendations.length !== 1 ? "s" : ""}
            </span>
          </div>
          <span className="text-sm font-medium">
            {formatCurrency(totalSavings)} potential savings
          </span>
        </div>

        {/* Service-specific recommendations table */}
        <ServiceRecommendationsTable service={service} recommendations={recommendations} />

        {/* Commitment comparison for EC2 / RDS */}
        {showCommitment && (
          <CommitmentComparison service={service} recommendations={recommendations} />
        )}
      </div>

      {/* Chat panel — right column */}
      <div className="w-[380px] shrink-0 border-l pl-4 flex flex-col">
        <CfmChatPanel
          accountName={accountName}
          awsAccountId={awsAccountId}
          service={service}
          regions={regions}
          scanId={scanId}
          azureConversationId={azureConversationId}
          recommendations={recommendations}
        />
      </div>
    </div>
  );
}
