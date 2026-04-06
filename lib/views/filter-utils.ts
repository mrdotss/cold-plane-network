import type { CfmFilters, CspFilters } from "./types";

/**
 * Serialize a CfmFilters or CspFilters object to URLSearchParams.
 * Array values are joined with commas; undefined/empty values are omitted.
 */
export function serializeFilters(
  filters: CfmFilters | CspFilters,
): URLSearchParams {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null) continue;

    if (Array.isArray(value)) {
      if (value.length > 0) {
        params.set(key, value.join(","));
      }
    } else if (typeof value === "number") {
      params.set(key, String(value));
    } else if (typeof value === "string" && value !== "") {
      params.set(key, value);
    }
  }

  return params;
}

/** Known array-type filter keys */
const ARRAY_KEYS = new Set(["service", "priority", "severity", "category"]);

/** Known numeric filter keys */
const NUMERIC_KEYS = new Set(["minSavings"]);

/**
 * Deserialize URLSearchParams back to a CfmFilters or CspFilters object.
 * Recognizes known array keys (comma-separated) and numeric keys.
 */
export function deserializeFilters(
  params: URLSearchParams,
): CfmFilters | CspFilters {
  const result: Record<string, unknown> = {};

  for (const [key, value] of params.entries()) {
    if (!value) continue;

    if (ARRAY_KEYS.has(key)) {
      result[key] = value.split(",");
    } else if (NUMERIC_KEYS.has(key)) {
      const num = Number(value);
      if (!isNaN(num)) {
        result[key] = num;
      }
    } else {
      result[key] = value;
    }
  }

  return result as CfmFilters | CspFilters;
}
