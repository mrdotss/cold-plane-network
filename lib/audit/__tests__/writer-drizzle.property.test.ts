import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fc from "fast-check";
import { AUDIT_EVENT_TYPES } from "../events";

// Mock server-only
vi.mock("server-only", () => ({}));

// In-memory audit event store
let auditStore: Array<{
  userId: string;
  eventType: string;
  metadata: string;
  ipAddress: string | null;
  userAgent: string | null;
}>;

const mockInsert = vi.fn();

vi.mock("@/lib/db/client", () => ({
  db: {
    insert: (...args: unknown[]) => mockInsert(...args),
  },
}));

vi.mock("@/lib/db/schema", () => ({
  auditEvents: { __table: "audit_events" },
}));

import { writeAuditEvent } from "../writer";

beforeEach(() => {
  auditStore = [];
  mockInsert.mockReset();

  // Mock insert: store the event in memory and capture the values
  mockInsert.mockImplementation(() => ({
    values: (data: {
      userId: string;
      eventType: string;
      metadata: string;
      ipAddress: string | null;
      userAgent: string | null;
    }) => {
      auditStore.push({ ...data });
      return Promise.resolve();
    },
  }));
});

/**
 * Feature: sizing-v2-chatbot, Property 3: Audit event write-read round-trip
 * Validates: Requirements 2.5
 *
 * For any valid audit event input, writing the event and then reading
 * the stored data SHALL preserve the userId, eventType, and produce
 * valid redacted metadata (JSON string ≤ 1KB).
 */
describe("Property 3: Audit event write-read round-trip", () => {
  it("writeAuditEvent persists userId and eventType correctly", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.constantFrom(...AUDIT_EVENT_TYPES),
        async (userId, eventType) => {
          auditStore = [];

          await writeAuditEvent({
            userId,
            eventType,
            metadata: {},
          });

          expect(auditStore).toHaveLength(1);
          const stored = auditStore[0];
          expect(stored.userId).toBe(userId);
          expect(stored.eventType).toBe(eventType);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("stored metadata is always a valid JSON string ≤ 1KB", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.constantFrom(...AUDIT_EVENT_TYPES),
        fc.dictionary(
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.oneof(
            fc.string({ maxLength: 100 }),
            fc.integer(),
            fc.boolean()
          ),
          { minKeys: 0, maxKeys: 10 }
        ),
        async (userId, eventType, metadata) => {
          auditStore = [];

          await writeAuditEvent({
            userId,
            eventType,
            metadata,
          });

          expect(auditStore).toHaveLength(1);
          const stored = auditStore[0];

          // Metadata must be valid JSON
          expect(() => JSON.parse(stored.metadata)).not.toThrow();

          // Metadata must be ≤ 1KB
          expect(Buffer.byteLength(stored.metadata, "utf-8")).toBeLessThanOrEqual(1024);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("rejects invalid event types", async () => {
    const validEventTypes = new Set<string>(AUDIT_EVENT_TYPES);

    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }).filter(
          (s) => !validEventTypes.has(s)
        ),
        async (invalidType) => {
          auditStore = [];

          await expect(
            writeAuditEvent({
              userId: "test-user",
              eventType: invalidType as never,
              metadata: {},
            })
          ).rejects.toThrow("Invalid audit event type");

          // DB insert should NOT have been called
          expect(auditStore).toHaveLength(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("preserves optional ipAddress and userAgent when provided", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.constantFrom(...AUDIT_EVENT_TYPES),
        fc.option(fc.ipV4()),
        fc.option(fc.string({ minLength: 5, maxLength: 100 })),
        async (userId, eventType, ipAddress, userAgent) => {
          auditStore = [];

          await writeAuditEvent({
            userId,
            eventType,
            metadata: {},
            ipAddress: ipAddress ?? undefined,
            userAgent: userAgent ?? undefined,
          });

          expect(auditStore).toHaveLength(1);
          const stored = auditStore[0];

          if (ipAddress) {
            expect(stored.ipAddress).toBe(ipAddress);
          } else {
            expect(stored.ipAddress).toBeNull();
          }

          if (userAgent) {
            expect(stored.userAgent).toBe(userAgent);
          } else {
            expect(stored.userAgent).toBeNull();
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
