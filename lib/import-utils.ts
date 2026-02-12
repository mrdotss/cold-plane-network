/**
 * Normalization utilities for Azure resource import.
 * Pure functions — no DB or side effects.
 */

export interface NormalizedResource {
  name: string;
  type: string;
  location: string | null;
  kind: string | null;
  sku: string | null;
  subscriptionId: string | null;
  resourceGroup: string | null;
  tags: string; // JSON string
  raw: string;  // JSON string — original payload preserved
}

export function normalizeResource(raw: Record<string, unknown>): NormalizedResource {
  return {
    name: String(raw.name ?? ""),
    type: String(raw.type ?? "").toLowerCase(),
    location: raw.location != null ? String(raw.location) : null,
    kind: raw.kind != null ? String(raw.kind) : null,
    sku: typeof raw.sku === "object" && raw.sku !== null
      ? (raw.sku as Record<string, string>).name ?? (raw.sku as Record<string, string>).tier ?? null
      : raw.sku != null ? String(raw.sku) : null,
    subscriptionId: raw.subscriptionId != null ? String(raw.subscriptionId) : null,
    resourceGroup: raw.resourceGroup != null ? String(raw.resourceGroup) : null,
    tags: JSON.stringify(raw.tags ?? {}),
    raw: JSON.stringify(raw),
  };
}
