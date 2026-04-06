import { describe, it, expect, vi, beforeEach } from "vitest";
import fc from "fast-check";
import { serializeFilters, deserializeFilters } from "../filter-utils";

// ─── Generators ──────────────────────────────────────────────────────────────

const uuidArb = fc.uuid().map((u) => u.toString());

const featureArb = fc.constantFrom("cfm" as const, "csp" as const);

// Array values must not contain commas (the delimiter used in URL serialization)
const safeStringArb = fc.string({ minLength: 1, maxLength: 20 }).filter((s) => !s.includes(","));

const cfmFiltersArb = fc.record(
  {
    service: fc.array(safeStringArb, { minLength: 0, maxLength: 5 }),
    priority: fc.array(fc.constantFrom("high", "medium", "low"), { minLength: 0, maxLength: 3 }),
    accountId: fc.string({ minLength: 1, maxLength: 36 }),
    minSavings: fc.nat({ max: 100000 }),
    status: fc.constantFrom("open", "acknowledged", "implemented"),
  },
  { requiredKeys: [] },
);

const cspFiltersArb = fc.record(
  {
    severity: fc.array(fc.constantFrom("critical", "high", "medium", "low"), { minLength: 0, maxLength: 4 }),
    category: fc.array(safeStringArb, { minLength: 0, maxLength: 5 }),
    status: fc.constantFrom("open", "acknowledged", "remediated"),
    accountId: fc.string({ minLength: 1, maxLength: 36 }),
  },
  { requiredKeys: [] },
);

const filtersArb = fc.oneof(cfmFiltersArb, cspFiltersArb);

const sortOrderArb = fc.constantFrom("asc" as const, "desc" as const);

const savedViewRecordArb = (userId: string) =>
  fc.record({
    id: uuidArb,
    userId: fc.constant(userId),
    name: fc.string({ minLength: 1, maxLength: 50 }),
    feature: featureArb,
    filters: filtersArb,
    sortBy: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: null }),
    sortOrder: fc.option(sortOrderArb, { nil: null }),
    createdAt: fc.date({ min: new Date("2024-01-01"), max: new Date("2025-12-31") }),
    updatedAt: fc.date({ min: new Date("2024-01-01"), max: new Date("2025-12-31") }),
  });


// ─── In-memory store to mock Drizzle DB layer ───────────────────────────────

type ViewRecord = {
  id: string;
  userId: string;
  name: string;
  feature: "cfm" | "csp";
  filters: Record<string, unknown>;
  sortBy: string | null;
  sortOrder: "asc" | "desc" | null;
  createdAt: Date;
  updatedAt: Date;
};

function createInMemoryViewStore() {
  let views: ViewRecord[] = [];

  return {
    reset() {
      views = [];
    },
    seed(records: ViewRecord[]) {
      views = [...records];
    },
    getViewsByUser(userId: string, feature?: string): ViewRecord[] {
      return views
        .filter((v) => v.userId === userId && (!feature || v.feature === feature))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    },
    createView(
      userId: string,
      data: { name: string; feature: "cfm" | "csp"; filters: Record<string, unknown>; sortBy?: string; sortOrder?: "asc" | "desc" },
    ): ViewRecord {
      const now = new Date();
      const view: ViewRecord = {
        id: crypto.randomUUID(),
        userId,
        name: data.name,
        feature: data.feature,
        filters: data.filters,
        sortBy: data.sortBy ?? null,
        sortOrder: data.sortOrder ?? null,
        createdAt: now,
        updatedAt: now,
      };
      views.push(view);
      return view;
    },
    getViewById(id: string): ViewRecord | null {
      return views.find((v) => v.id === id) ?? null;
    },
    updateView(
      id: string,
      userId: string,
      data: Partial<{ name: string; filters: Record<string, unknown>; sortBy: string | null; sortOrder: "asc" | "desc" | null }>,
    ): ViewRecord | null {
      const idx = views.findIndex((v) => v.id === id && v.userId === userId);
      if (idx === -1) return null;
      views[idx] = { ...views[idx], ...data, updatedAt: new Date() };
      return views[idx];
    },
    deleteView(id: string, userId: string): boolean {
      const idx = views.findIndex((v) => v.id === id && v.userId === userId);
      if (idx === -1) return false;
      views.splice(idx, 1);
      return true;
    },
  };
}


// ─── Property Tests ─────────────────────────────────────────────────────────

describe("Feature: phase5-dashboard-ux — Saved Views Properties", () => {
  const store = createInMemoryViewStore();

  beforeEach(() => {
    store.reset();
  });

  // ── Property 1: Views are user-scoped ──────────────────────────────────────
  // **Validates: Requirement 5.1**
  describe("Property 1: Views are user-scoped", () => {
    it("GET returns only views belonging to the queried userId", () => {
      fc.assert(
        fc.property(
          uuidArb,
          uuidArb,
          fc.array(savedViewRecordArb("placeholder"), { minLength: 1, maxLength: 10 }),
          fc.array(savedViewRecordArb("placeholder"), { minLength: 1, maxLength: 10 }),
          (userA, userB, viewsA, viewsB) => {
            // Ensure distinct users
            fc.pre(userA !== userB);

            store.reset();

            // Assign ownership
            const ownedByA = viewsA.map((v) => ({ ...v, userId: userA }));
            const ownedByB = viewsB.map((v) => ({ ...v, userId: userB }));
            store.seed([...ownedByA, ...ownedByB]);

            // Query for user A
            const resultA = store.getViewsByUser(userA);
            expect(resultA.every((v) => v.userId === userA)).toBe(true);
            expect(resultA.length).toBe(ownedByA.length);

            // Query for user B
            const resultB = store.getViewsByUser(userB);
            expect(resultB.every((v) => v.userId === userB)).toBe(true);
            expect(resultB.length).toBe(ownedByB.length);

            // No cross-contamination
            const allAIds = new Set(ownedByA.map((v) => v.id));
            expect(resultB.some((v) => allAIds.has(v.id))).toBe(false);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // ── Property 2: Views feature filter is correct ────────────────────────────
  // **Validates: Requirement 5.2**
  describe("Property 2: Views feature filter is correct", () => {
    it("filtering by feature returns only matching views, which is a subset of all user views", () => {
      fc.assert(
        fc.property(
          uuidArb,
          fc.array(savedViewRecordArb("placeholder"), { minLength: 1, maxLength: 15 }),
          featureArb,
          (userId, views, filterFeature) => {
            store.reset();
            const owned = views.map((v) => ({ ...v, userId }));
            store.seed(owned);

            const allViews = store.getViewsByUser(userId);
            const filtered = store.getViewsByUser(userId, filterFeature);

            // All returned views match the requested feature
            expect(filtered.every((v) => v.feature === filterFeature)).toBe(true);

            // Filtered set is a subset of all views
            const allIds = new Set(allViews.map((v) => v.id));
            expect(filtered.every((v) => allIds.has(v.id))).toBe(true);

            // Count matches expected
            const expectedCount = owned.filter((v) => v.feature === filterFeature).length;
            expect(filtered.length).toBe(expectedCount);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // ── Property 3: View creation round-trip ───────────────────────────────────
  // **Validates: Requirement 5.3**
  describe("Property 3: View creation round-trip", () => {
    it("creating a view and retrieving it preserves all fields", () => {
      fc.assert(
        fc.property(
          uuidArb,
          fc.string({ minLength: 1, maxLength: 50 }),
          featureArb,
          filtersArb,
          fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: undefined }),
          fc.option(sortOrderArb, { nil: undefined }),
          (userId, name, feature, filters, sortBy, sortOrder) => {
            store.reset();

            const created = store.createView(userId, {
              name,
              feature,
              filters: filters as Record<string, unknown>,
              sortBy,
              sortOrder,
            });

            const retrieved = store.getViewsByUser(userId);
            expect(retrieved.length).toBe(1);

            const view = retrieved[0];
            expect(view.id).toBe(created.id);
            expect(view.name).toBe(name);
            expect(view.feature).toBe(feature);
            expect(view.filters).toEqual(filters);
            expect(view.sortBy).toBe(sortBy ?? null);
            expect(view.sortOrder).toBe(sortOrder ?? null);
            expect(view.userId).toBe(userId);
          },
        ),
        { numRuns: 100 },
      );
    });
  });


  // ── Property 4: Views ownership enforcement ────────────────────────────────
  // **Validates: Requirements 5.4, 5.7**
  describe("Property 4: Views ownership enforcement", () => {
    it("updateView by non-owner returns null, deleteView by non-owner returns false", () => {
      fc.assert(
        fc.property(
          uuidArb,
          uuidArb,
          fc.string({ minLength: 1, maxLength: 50 }),
          featureArb,
          filtersArb,
          (ownerUserId, otherUserId, name, feature, filters) => {
            fc.pre(ownerUserId !== otherUserId);

            store.reset();

            // Create a view owned by ownerUserId
            const created = store.createView(ownerUserId, {
              name,
              feature,
              filters: filters as Record<string, unknown>,
            });

            // Non-owner tries to update
            const updateResult = store.updateView(created.id, otherUserId, {
              name: "hacked",
            });
            expect(updateResult).toBeNull();

            // View should be unchanged
            const unchanged = store.getViewById(created.id);
            expect(unchanged).not.toBeNull();
            expect(unchanged!.name).toBe(name);

            // Non-owner tries to delete
            const deleteResult = store.deleteView(created.id, otherUserId);
            expect(deleteResult).toBe(false);

            // View should still exist
            const stillExists = store.getViewById(created.id);
            expect(stillExists).not.toBeNull();
            expect(stillExists!.id).toBe(created.id);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // ── Property 5: Filter URL serialization round-trip ────────────────────────
  // **Validates: Requirement 6.4**
  describe("Property 5: Filter URL serialization round-trip", () => {
    it("CfmFilters survive serialize → deserialize round-trip", () => {
      fc.assert(
        fc.property(cfmFiltersArb, (filters) => {
          const params = serializeFilters(filters);
          const restored = deserializeFilters(params);

          // Build expected: only non-empty, non-undefined values survive
          const expected: Record<string, unknown> = {};
          for (const [key, value] of Object.entries(filters)) {
            if (value === undefined || value === null) continue;
            if (Array.isArray(value) && value.length === 0) continue;
            if (typeof value === "string" && value === "") continue;
            expected[key] = value;
          }

          expect(restored).toEqual(expected);
        }),
        { numRuns: 100 },
      );
    });

    it("CspFilters survive serialize → deserialize round-trip", () => {
      fc.assert(
        fc.property(cspFiltersArb, (filters) => {
          const params = serializeFilters(filters);
          const restored = deserializeFilters(params);

          const expected: Record<string, unknown> = {};
          for (const [key, value] of Object.entries(filters)) {
            if (value === undefined || value === null) continue;
            if (Array.isArray(value) && value.length === 0) continue;
            if (typeof value === "string" && value === "") continue;
            expected[key] = value;
          }

          expect(restored).toEqual(expected);
        }),
        { numRuns: 100 },
      );
    });
  });
});
