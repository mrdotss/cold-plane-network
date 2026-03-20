import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fc from "fast-check";
import { AUDIT_EVENT_TYPES } from "../events";

// Mock server-only to allow importing in test environment
vi.mock("server-only", () => ({}));

// Mock Drizzle client
const mockValues = vi.fn().mockResolvedValue(undefined);
const mockInsert = vi.fn().mockReturnValue({ values: mockValues });
vi.mock("@/lib/db/client", () => ({
  db: {
    insert: (...args: unknown[]) => mockInsert(...args),
  },
}));

vi.mock("@/lib/db/schema", () => ({
  auditEvents: { __table: "audit_events" },
}));

import { writeAuditEvent } from "../writer";

const validEventTypes = new Set<string>(AUDIT_EVENT_TYPES);

/**
 * Feature: sizing-v2-chatbot, Property 9: Audit event type validation
 * Validates: Requirements 2.5
 *
 * For any string that is not in the valid event type set,
 * the writeAuditEvent function SHALL reject the event.
 */
describe("Property 9: Audit event type validation", () => {
  beforeEach(() => {
    mockInsert.mockClear();
    mockValues.mockClear();
  });

  it("rejects any string not in the valid event type set", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }).filter(
          (s) => !validEventTypes.has(s)
        ),
        async (invalidType) => {
          await expect(
            writeAuditEvent({
              userId: "test-user",
              // Force the invalid type through the type system
              eventType: invalidType as never,
              metadata: {},
            })
          ).rejects.toThrow("Invalid audit event type");

          // DB insert should NOT have been called
          expect(mockValues).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });

  it("accepts all valid event types", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...AUDIT_EVENT_TYPES),
        async (validType) => {
          mockInsert.mockClear();
          mockValues.mockClear();
          await writeAuditEvent({
            userId: "test-user",
            eventType: validType,
            metadata: {},
          });
          expect(mockValues).toHaveBeenCalledOnce();
        }
      ),
      { numRuns: 100 }
    );
  });
});
