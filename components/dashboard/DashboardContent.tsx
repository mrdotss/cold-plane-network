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
} from "@hugeicons/core-free-icons";

interface DashboardData {
  stats: {
    projects: number;
    sizingReports: number;
    auditEvents: number;
    totalMonthlyEstimate: number;
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

function formatCurrency(value: number): string {
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

const statCards = [
  {
    title: "Migration Projects",
    icon: Folder01Icon,
    key: "projects" as const,
    href: "/dashboard/migration",
    format: (v: number) => String(v),
    description: "Active migration projects",
  },
  {
    title: "Monthly Estimate",
    icon: MoneyBag02Icon,
    key: "totalMonthlyEstimate" as const,
    href: "/dashboard/sizing",
    format: (v: number) => (v > 0 ? formatCurrency(v) : "—"),
    description: "Latest sizing estimate",
  },
  {
    title: "Sizing Reports",
    icon: AiInnovation01Icon,
    key: "sizingReports" as const,
    href: "/dashboard/sizing",
    format: (v: number) => String(v),
    description: "Total reports generated",
  },
  {
    title: "Audit Events",
    icon: ShieldIcon,
    key: "auditEvents" as const,
    href: "/dashboard/audit",
    format: (v: number) => String(v),
    description: "Total logged events",
  },
];

export function DashboardContent({ data }: { data: DashboardData }) {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      {/* Stat cards row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <Card key={card.key}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription className="text-sm">{card.title}</CardDescription>
              <HugeiconsIcon
                icon={card.icon}
                strokeWidth={2}
                className="size-4 text-muted-foreground"
              />
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
        ))}
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
                <HugeiconsIcon
                  icon={AiInnovation01Icon}
                  strokeWidth={1.5}
                  className="size-10 text-muted-foreground/40 mb-3"
                />
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
                        {formatCurrency(r.totalMonthly)}
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
                <HugeiconsIcon
                  icon={ShieldIcon}
                  strokeWidth={1.5}
                  className="size-10 text-muted-foreground/40 mb-3"
                />
                <p className="text-sm text-muted-foreground">No activity yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {data.recentAuditEvents.map((e) => (
                  <div key={e.id} className="flex items-start gap-3">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
                      <HugeiconsIcon icon={ShieldIcon} strokeWidth={2} className="size-3.5 text-muted-foreground" />
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
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
