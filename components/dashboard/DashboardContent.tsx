"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Folder01Icon,
  AiInnovation01Icon,
  ShieldIcon,
  MoneyBag02Icon,
  ArrowRight01Icon,
  AnalyticsUpIcon,
  ArrowDataTransferHorizontalIcon,
  MapsIcon,
  Comment01Icon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface DashboardData {
  stats: {
    projects: number;
    sizingReports: number;
    auditEvents: number;
    totalMonthlyEstimate: number;
    cfmAccounts: number;
    cfmScans: number;
    cfmTotalSavings: number;
  };
  recentSizingReports: {
    id: string;
    fileName: string;
    reportType: string;
    totalMonthly: number;
    serviceCount: number;
    createdAt: string;
  }[];
  recentAuditEvents: {
    id: string;
    eventType: string;
    metadata: string;
    createdAt: string;
  }[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCurrencyPrecise(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(value);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function eventLabel(eventType: string): string {
  return eventType
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function reportTypeBadge(type: string) {
  const variants: Record<string, "default" | "secondary" | "outline"> = {
    full: "default",
    recommend: "secondary",
    report: "outline",
  };
  return (
    <Badge variant={variants[type] ?? "outline"} className="text-xs">
      {type}
    </Badge>
  );
}

function eventIcon(eventType: string): IconSvgElement {
  const t = eventType.toLowerCase();
  if (t.includes("cfm") || t.includes("scan")) return AnalyticsUpIcon;
  if (t.includes("migration") || t.includes("mapping")) return ArrowDataTransferHorizontalIcon;
  if (t.includes("sizing") || t.includes("report")) return AiInnovation01Icon;
  if (t.includes("chat") || t.includes("message")) return Comment01Icon;
  if (t.includes("auth") || t.includes("login")) return ShieldIcon;
  return ShieldIcon;
}

// ─── Stat cards config ───────────────────────────────────────────────────────

interface StatCard {
  title: string;
  icon: IconSvgElement;
  key: keyof DashboardData["stats"];
  href: string;
  format: (v: number) => string;
  description: string;
}

const statCards: StatCard[] = [
  {
    title: "CFM Savings Found",
    icon: AnalyticsUpIcon,
    key: "cfmTotalSavings",
    href: "/dashboard/cfm",
    format: (v: number) => (v > 0 ? formatCurrency(v) : "$0"),
    description: "Potential monthly savings",
  },
  {
    title: "Monthly Estimate",
    icon: MoneyBag02Icon,
    key: "totalMonthlyEstimate",
    href: "/dashboard/sizing",
    format: (v: number) => (v > 0 ? formatCurrencyPrecise(v) : "--"),
    description: "Latest sizing estimate",
  },
  {
    title: "Migration Projects",
    icon: Folder01Icon,
    key: "projects",
    href: "/dashboard/migration",
    format: (v: number) => String(v),
    description: "Active migration projects",
  },
  {
    title: "Sizing Reports",
    icon: AiInnovation01Icon,
    key: "sizingReports",
    href: "/dashboard/sizing",
    format: (v: number) => String(v),
    description: "Total reports generated",
  },
  {
    title: "AWS Accounts",
    icon: AnalyticsUpIcon,
    key: "cfmAccounts",
    href: "/dashboard/cfm",
    format: (v: number) => String(v),
    description: "Connected for CFM analysis",
  },
  {
    title: "Audit Events",
    icon: ShieldIcon,
    key: "auditEvents",
    href: "/dashboard/audit",
    format: (v: number) => String(v),
    description: "Total logged events",
  },
];

// ─── Quick Actions config ────────────────────────────────────────────────────

interface QuickAction {
  title: string;
  description: string;
  href: string;
  icon: IconSvgElement;
}

const quickActions: QuickAction[] = [
  {
    title: "Topology Studio",
    description: "Design network topologies with live preview and artifact generation",
    href: "/dashboard/studio",
    icon: MapsIcon,
  },
  {
    title: "Migration Advisor",
    description: "Map Azure resources to AWS equivalents with confidence ratings",
    href: "/dashboard/migration",
    icon: ArrowDataTransferHorizontalIcon,
  },
  {
    title: "AI Sizing",
    description: "Upload pricing data and get AI-powered sizing recommendations",
    href: "/dashboard/sizing",
    icon: AiInnovation01Icon,
  },
  {
    title: "CFM Analysis",
    description: "Connect AWS accounts and scan for cost optimization opportunities",
    href: "/dashboard/cfm",
    icon: AnalyticsUpIcon,
  },
];

// ─── Component ───────────────────────────────────────────────────────────────

export function DashboardContent({ data }: { data: DashboardData }) {
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 pt-0">
      {/* Stat cards row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {statCards.map((card) => (
          <Link key={card.key} href={card.href} className="group">
            <Card className="transition-all hover:shadow-md group-hover:border-primary/30">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardDescription className="text-sm">{card.title}</CardDescription>
                <div className="flex size-7 items-center justify-center rounded-lg bg-muted">
                  <HugeiconsIcon icon={card.icon} strokeWidth={2} className="size-3.5 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold tracking-tight">
                  {card.format(data.stats[card.key])}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {card.description}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3">Quick Actions</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((action) => (
            <Link key={action.href} href={action.href} className="group">
              <Card className="h-full transition-all hover:shadow-md group-hover:border-primary/30">
                <CardContent className="flex items-start gap-3 pt-5">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                    <HugeiconsIcon icon={action.icon} strokeWidth={2} className="size-5 text-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium flex items-center gap-1">
                      {action.title}
                      <HugeiconsIcon
                        icon={ArrowRight01Icon}
                        strokeWidth={2}
                        className="size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                      />
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {action.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Two-column layout: Recent Reports + Recent Activity */}
      <div className="grid gap-4 lg:grid-cols-7">
        {/* Recent Sizing Reports — wider */}
        <Card className="lg:col-span-4">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Recent Sizing Reports</CardTitle>
              <CardDescription>Latest reports from the sizing tool</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/sizing">
                View all
                <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className="size-3.5 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {data.recentSizingReports.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="flex size-12 items-center justify-center rounded-xl bg-muted mb-3">
                  <HugeiconsIcon
                    icon={AiInnovation01Icon}
                    strokeWidth={1.5}
                    className="size-6 text-muted-foreground"
                  />
                </div>
                <p className="text-sm text-muted-foreground">No sizing reports yet</p>
                <Button variant="outline" size="sm" className="mt-3" asChild>
                  <Link href="/dashboard/sizing">Create your first report</Link>
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>File Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Monthly</TableHead>
                    <TableHead className="text-right">Services</TableHead>
                    <TableHead className="text-right">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recentSizingReports.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium max-w-48 truncate">
                        {r.fileName}
                      </TableCell>
                      <TableCell>{reportTypeBadge(r.reportType)}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrencyPrecise(r.totalMonthly)}
                      </TableCell>
                      <TableCell className="text-right">{r.serviceCount}</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatDate(r.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity — narrower */}
        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Recent Activity</CardTitle>
              <CardDescription>Your latest audit events</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/audit">
                View all
                <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className="size-3.5 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {data.recentAuditEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="flex size-12 items-center justify-center rounded-xl bg-muted mb-3">
                  <HugeiconsIcon
                    icon={ShieldIcon}
                    strokeWidth={1.5}
                    className="size-6 text-muted-foreground"
                  />
                </div>
                <p className="text-sm text-muted-foreground">No activity yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {data.recentAuditEvents.map((e) => {
                  const icon = eventIcon(e.eventType);
                  return (
                    <div key={e.id} className="flex items-start gap-3">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                        <HugeiconsIcon icon={icon} strokeWidth={2} className="size-3.5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-none truncate">
                          {eventLabel(e.eventType)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDate(e.createdAt)} at {formatTime(e.createdAt)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
