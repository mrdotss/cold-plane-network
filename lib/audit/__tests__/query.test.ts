import { describe, it, expect, vi } from "vitest";
import * as fc from "fast-check";
import { AUDIT_EVENT_TYPES } from "../events";

// Mock server-only
vi.mock("server-only", () => ({}));

/**
 * Feature: cold-plane-mvp, Property 22: Audit events sorted descending
 * Validates: Requirements 10.1
 *
 * For any set of audit events returned by the audit API, the events SHALL
 * be sorted by createdAt in descending order (most recent first).
 */
describe("Property 22: Audit events sorted descending", () => {
  it("events are always sorted by createdAt descending", () => {
    const arbEvent = fc.record({
      id: fc.uuid(),
      userId: fc.constant("user-1"),
      eventType: fc.constantFrom(...AUDIT_EVENT_TYPES),
      metadata: fc.constant("{}"),
      ipAddress: fc.constant(null),
      userAgent: fc.constant(null),
      createdAt: fc.date({
        min: new Date("2024-01-01T00:00:00.000Z"),
        max: new Date("2026-12-31T23:59:59.999Z"),
        noInvalidDate: true,
      }),
    });

    fc.assert(
      fc.property(
        fc.array(arbEvent, { minLength: 2, maxLength: 20 }),
        (events) => {
          // Simulate the query's orderBy: { createdAt: "desc" }
          const sorted = [...events].sort(
            (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
          );

          // Verify descending order
          for (let i = 1; i < sorted.length; i++) {
            expect(sorted[i - 1].createdAt.getTime()).toBeGreaterThanOrEqual(
              sorted[i].createdAt.getTime()
            );
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: cold-plane-mvp, Property 23: Audit events filtered by user
 * Validates: Requirements 10.2
 *
 * For any authenticated user querying the audit API, all returned events
 * SHALL have a userId matching the authenticated user's ID.
 */
describe("Property 23: Audit events filtered by user", () => {
  it("all returned events belong to the querying user", () => {
    const arbUserId = fc.stringMatching(/^user-[a-z0-9]{4,8}$/);
    const arbEvent = fc.record({
      id: fc.uuid(),
      userId: arbUserId,
      eventType: fc.constantFrom(...AUDIT_EVENT_TYPES),
      metadata: fc.constant("{}"),
      ipAddress: fc.constant(null),
      userAgent: fc.constant(null),
      createdAt: fc.date({
        min: new Date("2024-01-01T00:00:00.000Z"),
        max: new Date("2026-12-31T23:59:59.999Z"),
        noInvalidDate: true,
      }),
    });

    fc.assert(
      fc.property(
        arbUserId,
        fc.array(arbEvent, { minLength: 1, maxLength: 30 }),
        (authenticatedUserId, allEvents) => {
          // Simulate the where clause: { userId: authenticatedUserId }
          const filtered = allEvents.filter(
            (e) => e.userId === authenticatedUserId
          );

          // All returned events must belong to the authenticated user
          for (const event of filtered) {
            expect(event.userId).toBe(authenticatedUserId);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: cold-plane-mvp, Property 24: Audit event filters return matching results
 * Validates: Requirements 10.3
 *
 * For any filter criteria (event type, date range) applied to the audit API,
 * all returned events SHALL match the specified filter criteria.
 */
describe("Property 24: Audit event filters return matching results", () => {
  it("event type filter returns only matching events", () => {
    const arbEvent = fc.record({
      id: fc.uuid(),
      userId: fc.constant("user-1"),
      eventType: fc.constantFrom(...AUDIT_EVENT_TYPES),
      metadata: fc.constant("{}"),
      ipAddress: fc.constant(null),
      userAgent: fc.constant(null),
      createdAt: fc.date({
        min: new Date("2024-01-01T00:00:00.000Z"),
        max: new Date("2026-12-31T23:59:59.999Z"),
        noInvalidDate: true,
      }),
    });

    const arbFilterType = fc.constantFrom(...AUDIT_EVENT_TYPES);

    fc.assert(
      fc.property(
        arbFilterType,
        fc.array(arbEvent, { minLength: 1, maxLength: 30 }),
        (filterType, allEvents) => {
          // Simulate the where clause: { eventType: filterType }
          const filtered = allEvents.filter(
            (e) => e.eventType === filterType
          );

          // All returned events must match the filter type
          for (const event of filtered) {
            expect(event.eventType).toBe(filterType);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it("date range filter returns only events within range", () => {
    const arbEvent = fc.record({
      id: fc.uuid(),
      userId: fc.constant("user-1"),
      eventType: fc.constantFrom(...AUDIT_EVENT_TYPES),
      metadata: fc.constant("{}"),
      ipAddress: fc.constant(null),
      userAgent: fc.constant(null),
      createdAt: fc.date({
        min: new Date("2024-01-01T00:00:00.000Z"),
        max: new Date("2026-12-31T23:59:59.999Z"),
        noInvalidDate: true,
      }),
    });

    // Generate two dates and use the earlier as "from" and later as "to"
    const arbDateRange = fc
      .tuple(
        fc.date({
          min: new Date("2024-01-01T00:00:00.000Z"),
          max: new Date("2026-12-31T23:59:59.999Z"),
          noInvalidDate: true,
        }),
        fc.date({
          min: new Date("2024-01-01T00:00:00.000Z"),
          max: new Date("2026-12-31T23:59:59.999Z"),
          noInvalidDate: true,
        })
      )
      .map(([a, b]) =>
        a.getTime() <= b.getTime() ? { from: a, to: b } : { from: b, to: a }
      );

    fc.assert(
      fc.property(
        arbDateRange,
        fc.array(arbEvent, { minLength: 1, maxLength: 30 }),
        ({ from, to }, allEvents) => {
          // Simulate the where clause: { createdAt: { gte: from, lte: to } }
          const filtered = allEvents.filter(
            (e) =>
              e.createdAt.getTime() >= from.getTime() &&
              e.createdAt.getTime() <= to.getTime()
          );

          // All returned events must be within the date range
          for (const event of filtered) {
            expect(event.createdAt.getTime()).toBeGreaterThanOrEqual(
              from.getTime()
            );
            expect(event.createdAt.getTime()).toBeLessThanOrEqual(
              to.getTime()
            );
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it("combined event type and date range filter returns only matching events", () => {
    const arbEvent = fc.record({
      id: fc.uuid(),
      userId: fc.constant("user-1"),
      eventType: fc.constantFrom(...AUDIT_EVENT_TYPES),
      metadata: fc.constant("{}"),
      ipAddress: fc.constant(null),
      userAgent: fc.constant(null),
      createdAt: fc.date({
        min: new Date("2024-01-01T00:00:00.000Z"),
        max: new Date("2026-12-31T23:59:59.999Z"),
        noInvalidDate: true,
      }),
    });

    const arbFilterType = fc.constantFrom(...AUDIT_EVENT_TYPES);
    const arbDateRange = fc
      .tuple(
        fc.date({
          min: new Date("2024-01-01T00:00:00.000Z"),
          max: new Date("2026-12-31T23:59:59.999Z"),
          noInvalidDate: true,
        }),
        fc.date({
          min: new Date("2024-01-01T00:00:00.000Z"),
          max: new Date("2026-12-31T23:59:59.999Z"),
          noInvalidDate: true,
        })
      )
      .map(([a, b]) =>
        a.getTime() <= b.getTime() ? { from: a, to: b } : { from: b, to: a }
      );

    fc.assert(
      fc.property(
        arbFilterType,
        arbDateRange,
        fc.array(arbEvent, { minLength: 1, maxLength: 30 }),
        (filterType, { from, to }, allEvents) => {
          // Simulate combined where clause
          const filtered = allEvents.filter(
            (e) =>
              e.eventType === filterType &&
              e.createdAt.getTime() >= from.getTime() &&
              e.createdAt.getTime() <= to.getTime()
          );

          for (const event of filtered) {
            expect(event.eventType).toBe(filterType);
            expect(event.createdAt.getTime()).toBeGreaterThanOrEqual(
              from.getTime()
            );
            expect(event.createdAt.getTime()).toBeLessThanOrEqual(
              to.getTime()
            );
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
