"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Skeleton matching AccountCard layout */
export function AccountCardSkeleton() {
  return (
    <Card size="sm">
      <CardHeader>
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-3 w-16 mt-1" />
      </CardHeader>
      <CardContent className="flex items-center gap-3">
        <div className="flex flex-col gap-1">
          <Skeleton className="h-3 w-14" />
          <Skeleton className="h-3 w-20" />
        </div>
        <div className="flex flex-col gap-1">
          <Skeleton className="h-3 w-18" />
          <Skeleton className="h-5 w-12 rounded-full" />
        </div>
      </CardContent>
      <div className="px-4 pb-3 flex gap-1">
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-6 w-14" />
        <Skeleton className="h-6 w-16" />
      </div>
    </Card>
  );
}

/** Skeleton for the account grid (3 placeholder cards) */
export function AccountGridSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-8 w-28" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <AccountCardSkeleton />
        <AccountCardSkeleton />
        <AccountCardSkeleton />
      </div>
    </div>
  );
}

/** Skeleton matching SummaryCards (4 metric cards) */
export function SummaryCardsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card size="sm" key={i}>
          <CardHeader className="pb-1">
            <Skeleton className="h-3 w-20" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-6 w-24" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/** Skeleton matching ServiceCard layout */
export function ServiceCardSkeleton() {
  return (
    <Card size="sm" className="h-full">
      <CardHeader className="pb-1">
        <Skeleton className="h-4 w-16" />
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-20" />
        </div>
      </CardContent>
    </Card>
  );
}

/** Skeleton for the 3-column service grid */
export function ServiceGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <ServiceCardSkeleton />
      <ServiceCardSkeleton />
      <ServiceCardSkeleton />
    </div>
  );
}

/** Skeleton matching RecommendationsTable */
export function RecommendationsTableSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-4 w-40" />
      <div className="flex flex-col gap-0 border rounded-md">
        {/* Header row */}
        <div className="flex items-center gap-4 px-4 py-2 border-b bg-muted/30">
          <Skeleton className="h-3 w-14" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-32 flex-1" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-12" />
        </div>
        {/* Data rows */}
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-2.5 border-b last:border-b-0">
            <Skeleton className="h-5 w-14 rounded-full" />
            <div className="flex flex-col gap-1">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-2.5 w-16" />
            </div>
            <Skeleton className="h-3 w-40 flex-1" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-5 w-12 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Skeleton for the full dashboard (summary + grid + table) */
export function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-8 w-40" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-28" />
        </div>
      </div>
      <SummaryCardsSkeleton />
      <ServiceGridSkeleton />
      <RecommendationsTableSkeleton />
    </div>
  );
}

/** Skeleton for the service deep dive (two-column layout) */
export function DeepDiveSkeleton() {
  return (
    <div className="flex gap-4 h-full">
      {/* Main content */}
      <div className="flex-1 min-w-0 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-3 w-28" />
          </div>
          <Skeleton className="h-4 w-32" />
        </div>
        <RecommendationsTableSkeleton />
      </div>
      {/* Chat panel placeholder */}
      <div className="w-[380px] shrink-0 border-l pl-4 flex flex-col gap-3">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-32 w-full rounded-md" />
        <Skeleton className="h-8 w-full rounded-md" />
      </div>
    </div>
  );
}
