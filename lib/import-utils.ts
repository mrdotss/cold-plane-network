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
  armId: string | null;
  tags: string; // JSON string
  raw: string;  // JSON string — original payload preserved
}

/**
 * Parse an ARM resource ID to extract subscriptionId and resourceGroup.
 * Returns null for malformed IDs.
 */
export function parseArmIdForImport(
  armId: string,
): { subscriptionId: string; resourceGroup: string } | null {
  const segments = armId.split("/");
  if (segments.length < 9) return null;
  if (segments[1]?.toLowerCase() !== "subscriptions") return null;
  if (segments[3]?.toLowerCase() !== "resourcegroups") return null;
  return {
    subscriptionId: segments[2],
    resourceGroup: segments[4],
  };
}

export function normalizeResource(raw: Record<string, unknown>): NormalizedResource {
  const rawId = typeof raw.id === "string" && raw.id.startsWith("/subscriptions/")
    ? raw.id
    : null;

  const armParsed = rawId ? parseArmIdForImport(rawId) : null;

  return {
    name: String(raw.name ?? ""),
    type: String(raw.type ?? "").toLowerCase(),
    location: raw.location != null ? String(raw.location) : null,
    kind: raw.kind != null ? String(raw.kind) : null,
    sku: typeof raw.sku === "object" && raw.sku !== null
      ? (raw.sku as Record<string, string>).name ?? (raw.sku as Record<string, string>).tier ?? null
      : raw.sku != null ? String(raw.sku) : null,
    subscriptionId: raw.subscriptionId != null
      ? String(raw.subscriptionId)
      : armParsed?.subscriptionId ?? null,
    resourceGroup: raw.resourceGroup != null
      ? String(raw.resourceGroup)
      : armParsed?.resourceGroup ?? null,
    armId: rawId,
    tags: JSON.stringify(raw.tags ?? {}),
    raw: JSON.stringify(raw),
  };
}
