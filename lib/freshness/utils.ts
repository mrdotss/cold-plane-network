// ─── Freshness Utilities (Phase 5 — Real-Time Indicators) ───────────────────

export enum FreshnessState {
  Fresh = "fresh", // < 1 hour
  Stale = "stale", // 1–24 hours
  Old = "old", // > 24 hours
}

const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;

/**
 * Classify a timestamp into a freshness state based on elapsed time from now.
 */
export function getFreshnessState(completedAt: string | null): FreshnessState {
  if (completedAt === null) return FreshnessState.Old;

  const elapsed = Date.now() - new Date(completedAt).getTime();

  if (elapsed < MS_PER_HOUR) return FreshnessState.Fresh;
  if (elapsed < MS_PER_DAY) return FreshnessState.Stale;
  return FreshnessState.Old;
}

/**
 * Return a human-readable relative time string for a given timestamp.
 */
export function getRelativeTime(completedAt: string | null): string {
  if (completedAt === null) return "No scans yet";

  const elapsed = Date.now() - new Date(completedAt).getTime();

  if (elapsed < MS_PER_MINUTE) return "Just now";
  if (elapsed < MS_PER_HOUR) return `${Math.floor(elapsed / MS_PER_MINUTE)}m ago`;
  if (elapsed < MS_PER_DAY) return `${Math.floor(elapsed / MS_PER_HOUR)}h ago`;
  return `${Math.floor(elapsed / MS_PER_DAY)}d ago`;
}
