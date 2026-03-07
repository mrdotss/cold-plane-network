import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { redactMetadata } from "@/lib/audit/redact";
import type { AuditEventType } from "@/lib/audit/events";
import { METADATA_ALLOWLISTS } from "@/lib/audit/events";

const SIZING_EVENT_TYPES: AuditEventType[] = [
  "SIZING_UPLOAD",
  "SIZING_GENERATE_REPORT",
  "SIZING_AGENT_RECOMMEND",
  "SIZING_DOWNLOAD_EXCEL",
];

describe("Property 11: Audit redaction applies to sizing event types", () => {
  /**
   * **Validates: Requirements 7.5**
   * For each sizing event type and arbitrary metadata, redactMetadata()
   * returns only allowlisted fields within 1KB.
   */
  it("returns only allowlisted fields and stays within 1KB", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...SIZING_EVENT_TYPES),
        fc.dictionary(fc.string({ minLength: 1, maxLength: 20 }), fc.oneof(
          fc.string({ maxLength: 50 }),
          fc.integer(),
          fc.boolean(),
        ), { minKeys: 0, maxKeys: 10 }),
        (eventType, metadata) => {
          const result = redactMetadata(eventType, metadata);

          // Must be valid JSON
          const parsed = JSON.parse(result);

          // Must be within 1KB
          expect(Buffer.byteLength(result, "utf-8")).toBeLessThanOrEqual(1024);

          // All keys must be in the allowlist (or _truncated marker)
          const allowlist = METADATA_ALLOWLISTS[eventType];
          for (const key of Object.keys(parsed)) {
            if (key === "_truncated") continue;
            expect(allowlist).toContain(key);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
