"use client";

import { useCallback, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { serializeFilters, deserializeFilters } from "@/lib/views/filter-utils";
import type { SavedView, CfmFilters, CspFilters } from "@/lib/views/types";

type FilterObject = CfmFilters | CspFilters;

export interface UseFilterStateReturn<T extends FilterObject> {
  filters: T;
  setFilter: <K extends keyof T>(key: K, value: T[K]) => void;
  resetFilters: () => void;
  hasActiveFilters: boolean;
  toSearchParams: () => URLSearchParams;
  fromSearchParams: (params: URLSearchParams) => void;
  applyView: (view: SavedView) => void;
}

/**
 * Check if a filter value is "active" (non-empty).
 * Arrays must have length > 0, strings must be non-empty, numbers must be defined.
 */
function isActiveValue(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value !== "";
  if (typeof value === "number") return true;
  return false;
}

/**
 * Generic hook managing filter object state synced with URL query params.
 * Reads initial state from URL on mount; writes back on every change.
 */
export function useFilterState<T extends FilterObject>(): UseFilterStateReturn<T> {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Derive current filters from URL search params
  const filters = useMemo(() => {
    return deserializeFilters(searchParams) as T;
  }, [searchParams]);

  const hasActiveFilters = useMemo(() => {
    return Object.values(filters).some(isActiveValue);
  }, [filters]);

  const updateUrl = useCallback(
    (newFilters: T) => {
      const params = serializeFilters(newFilters);
      const qs = params.toString();
      router.replace(qs ? `?${qs}` : "?", { scroll: false });
    },
    [router],
  );

  const setFilter = useCallback(
    <K extends keyof T>(key: K, value: T[K]) => {
      const next = { ...filters, [key]: value } as T;
      // Remove empty values
      for (const k of Object.keys(next)) {
        if (!isActiveValue((next as Record<string, unknown>)[k])) {
          delete (next as Record<string, unknown>)[k];
        }
      }
      updateUrl(next);
    },
    [filters, updateUrl],
  );

  const resetFilters = useCallback(() => {
    updateUrl({} as T);
  }, [updateUrl]);

  const toSearchParams = useCallback(() => {
    return serializeFilters(filters);
  }, [filters]);

  const fromSearchParams = useCallback(
    (params: URLSearchParams) => {
      const restored = deserializeFilters(params) as T;
      updateUrl(restored);
    },
    [updateUrl],
  );

  const applyView = useCallback(
    (view: SavedView) => {
      const viewFilters = (view.filters ?? {}) as T;
      const params = serializeFilters(viewFilters);
      // Restore sort settings from the saved view
      if (view.sortBy) {
        params.set("sortBy", view.sortBy);
      } else {
        params.delete("sortBy");
      }
      if (view.sortOrder) {
        params.set("sortOrder", view.sortOrder);
      } else {
        params.delete("sortOrder");
      }
      const qs = params.toString();
      router.replace(qs ? `?${qs}` : "?", { scroll: false });
    },
    [router],
  );

  return {
    filters,
    setFilter,
    resetFilters,
    hasActiveFilters,
    toSearchParams,
    fromSearchParams,
    applyView,
  };
}
