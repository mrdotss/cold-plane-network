"use client";

import { getFreshnessState, FreshnessState } from "@/lib/freshness/utils";

interface LiveBadgeProps {
  completedAt: string | null;
}

const stateConfig: Record<FreshnessState, { color: string; pulse: boolean; label: string }> = {
  [FreshnessState.Fresh]: {
    color: "bg-green-500",
    pulse: true,
    label: "Data is fresh, updated less than 1 hour ago",
  },
  [FreshnessState.Stale]: {
    color: "bg-yellow-500",
    pulse: false,
    label: "Data is stale, updated between 1 and 24 hours ago",
  },
  [FreshnessState.Old]: {
    color: "bg-gray-400",
    pulse: false,
    label: "Data is old, updated more than 24 hours ago",
  },
};

export function LiveBadge({ completedAt }: LiveBadgeProps) {
  const state = getFreshnessState(completedAt);
  const { color, pulse, label } = stateConfig[state];

  return (
    <span className="relative inline-flex h-3 w-3 shrink-0" role="status" aria-label={label}>
      {pulse && (
        <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${color} opacity-75`} />
      )}
      <span className={`relative inline-flex h-3 w-3 rounded-full ${color}`} />
    </span>
  );
}
