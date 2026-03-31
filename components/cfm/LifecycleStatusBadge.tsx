"use client";

import { Badge } from "@/components/ui/badge";
import type { RecommendationLifecycleStatus } from "@/lib/cfm/types";

interface LifecycleStatusBadgeProps {
  status: RecommendationLifecycleStatus;
}

export function LifecycleStatusBadge({ status }: LifecycleStatusBadgeProps) {
  switch (status) {
    case "open":
      return <Badge variant="secondary">Open</Badge>;
    case "acknowledged":
      return (
        <Badge
          variant="outline"
          className="border-blue-500/50 text-blue-600 dark:text-blue-400"
        >
          Acknowledged
        </Badge>
      );
    case "implemented":
      return (
        <Badge
          variant="outline"
          className="border-amber-500/50 text-amber-600 dark:text-amber-400"
        >
          Implemented
        </Badge>
      );
    case "verified":
      return (
        <Badge
          variant="outline"
          className="border-green-500/50 text-green-600 dark:text-green-400"
        >
          Verified
        </Badge>
      );
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}
