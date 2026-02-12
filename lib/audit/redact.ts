/**
 * Audit metadata redaction.
 *
 * Strips denylisted fields, enforces field-level size limits,
 * and caps total serialized metadata at 1KB.
 */

import { type AuditEventType, METADATA_ALLOWLISTS } from "./events";

/** Fields that MUST NEVER appear in audit metadata at any nesting depth. */
const DENYLIST = new Set([
  "password",
  "passwordHash",
  "secret",
  "token",
  "apiKey",
  "credential",
  "specBody",
  "specContent",
  "artifactContent",
  "terraformCode",
]);

/** Maximum serialized length for any single metadata field value. */
const MAX_FIELD_LENGTH = 256;

/** Maximum total serialized metadata size in bytes. */
const MAX_METADATA_BYTES = 1024;

/**
 * Recursively strip denylisted keys and fields exceeding the length limit
 * from an object. Returns a new object (does not mutate the input).
 */
function stripFields(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    // Skip denylisted keys
    if (DENYLIST.has(key)) continue;

    // Recurse into nested objects
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      const nested = stripFields(value as Record<string, unknown>);
      // Only include if the nested object has remaining fields
      if (Object.keys(nested).length > 0) {
        result[key] = nested;
      }
      continue;
    }

    // Strip fields whose serialized value exceeds 256 chars
    const serialized = JSON.stringify(value);
    if (serialized.length > MAX_FIELD_LENGTH) continue;

    result[key] = value;
  }

  return result;
}

/**
 * Redact metadata for an audit event.
 *
 * 1. Apply allowlist filtering (only permitted fields for the event type)
 * 2. Strip denylisted fields at any depth
 * 3. Strip fields with serialized values > 256 chars
 * 4. Enforce 1KB total size cap with `_truncated: true` marker
 *
 * Returns a JSON string ready for DB persistence.
 */
export function redactMetadata(
  eventType: AuditEventType,
  metadata: Record<string, unknown>
): string {
  // Step 1: Apply allowlist — only keep fields permitted for this event type
  const allowlist = METADATA_ALLOWLISTS[eventType];
  let filtered: Record<string, unknown> = {};

  if (allowlist && allowlist.length > 0) {
    for (const key of allowlist) {
      if (key in metadata) {
        filtered[key] = metadata[key];
      }
    }
  }
  // If no allowlist fields matched but metadata was provided, still apply denylist
  // This handles cases where the allowlist is empty (e.g., AUTH_LOGOUT)
  if (allowlist.length === 0) {
    filtered = {};
  }

  // Step 2 & 3: Strip denylisted fields and long values recursively
  const stripped = stripFields(filtered);

  // Step 4: Enforce 1KB total size cap
  let serialized = JSON.stringify(stripped);

  if (Buffer.byteLength(serialized, "utf-8") <= MAX_METADATA_BYTES) {
    return serialized;
  }

  // Progressively remove fields until under the cap
  const keys = Object.keys(stripped);
  const truncated: Record<string, unknown> = { _truncated: true };

  // Add fields back one at a time, keeping essential ones
  for (const key of keys) {
    truncated[key] = stripped[key];
    const candidate = JSON.stringify(truncated);
    if (Buffer.byteLength(candidate, "utf-8") > MAX_METADATA_BYTES) {
      delete truncated[key];
      break;
    }
  }

  serialized = JSON.stringify(truncated);
  return serialized;
}
