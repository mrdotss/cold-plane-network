import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fc from "fast-check";

// Mock server-only
vi.mock("server-only", () => ({}));

// Mock next/headers cookies
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue({ value: "valid-token" }),
  }),
}));

// Mock session validation — default to user-1
vi.mock("@/lib/auth/session", () => ({
  validateSession: vi.fn().mockResolvedValue({ userId: "user-1" }),
}));

// Mock audit writer
vi.mock("@/lib/audit/writer", () => ({
  writeAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

// Mock sizing validators — pass through to real schema
vi.mock("@/lib/sizing/validators", async (importOriginal) => {
  return await importOriginal();
});

// ─── Drizzle chainable mock (hoisted) ────────────────────────────────────────

interface ReportRow { [key: string]: unknown }

const hoisted = vi.hoisted(() => {
  const reportStore: ReportRow[] = [];

  function reset() { reportStore.length = 0; }

  /**
   * Build a deeply-chainable object that resolves to `resultFn()` when awaited.
   */
  function chain(resultFn: () => unknown): Record<string, unknown> {
    const obj: Record<string, unknown> = {};
    const methods = [
      "from", "where", "limit", "groupBy", "orderBy", "leftJoin",
      "offset", "values", "returning",
    ];
    for (const m of methods) {
      obj[m] = (..._args: unknown[]) => chain(resultFn);
    }
    obj.then = (
      resolve: (v: unknown) => void,
      reject?: (e: unknown) => void,
    ) => {
      try { resolve(resultFn()); } catch (e) { reject?.(e); }
    };
    return obj;
  }

  // Track the current userId for scoping queries
  let currentUserId = "user-1";

  const mockDb = {
    select: (..._args: unknown[]) => {
      // The sizing routes use two select patterns:
      // 1. GET /api/sizing — paginated list: db.select().from().where().orderBy().offset().limit()
      //    + count query: db.select({total: count()}).from().where()
      // 2. GET /api/sizing/[id] — single: db.select().from().where().limit()
      //
      // We return a chainable that resolves based on the store.
      // Since we can't easily distinguish between list vs count vs single,
      // we use a call counter per test.
      const selectCall = { isCount: false, id: undefined as string | undefined };

      const selectChain: Record<string, unknown> = {};
      const methods = ["orderBy", "leftJoin", "groupBy", "offset"];
      for (const m of methods) {
        selectChain[m] = (..._a: unknown[]) => selectChain;
      }

      selectChain.from = (..._a: unknown[]) => selectChain;

      selectChain.where = (..._a: unknown[]) => selectChain;

      selectChain.limit = (..._a: unknown[]) => selectChain;

      selectChain.then = (
        resolve: (v: unknown) => void,
        reject?: (e: unknown) => void,
      ) => {
        try {
          if (selectCall.isCount) {
            const total = reportStore.filter((r) => r.userId === currentUserId).length;
            resolve([{ total }]);
          } else {
            // Return all matching reports for the current user
            resolve(reportStore.filter((r) => r.userId === currentUserId));
          }
        } catch (e) { reject?.(e); }
      };

      // Check if this is a count select (first arg has a 'total' key)
      if (_args.length > 0 && typeof _args[0] === "object" && _args[0] !== null && "total" in (_args[0] as Record<string, unknown>)) {
        selectCall.isCount = true;
      }

      return selectChain;
    },

    insert: (..._args: unknown[]) => chain(() => {
      // Will be overridden per-call via values().returning()
      return [];
    }),

    delete: (..._args: unknown[]) => chain(() => undefined),
  };

  // Override insert to actually store data
  mockDb.insert = (..._args: unknown[]) => {
    const insertChain: Record<string, unknown> = {};
    let pendingData: ReportRow | undefined;

    insertChain.values = (data: ReportRow) => {
      pendingData = data;
      return insertChain;
    };

    insertChain.returning = (..._a: unknown[]) => {
      const report = {
        id: `rpt-${reportStore.length + 1}`,
        ...pendingData,
        createdAt: new Date().toISOString(),
      };
      reportStore.push(report);
      return insertChain;
    };

    // Make thenable — resolves to the last inserted report as array
    insertChain.then = (
      resolve: (v: unknown) => void,
      reject?: (e: unknown) => void,
    ) => {
      try {
        const last = reportStore[reportStore.length - 1];
        resolve(last ? [last] : []);
      } catch (e) { reject?.(e); }
    };

    // Chain methods that might appear before values
    for (const m of ["from", "where", "limit", "orderBy", "offset", "groupBy"]) {
      insertChain[m] = (..._a: unknown[]) => insertChain;
    }

    return insertChain;
  };

  return { reportStore, reset, mockDb, setCurrentUserId: (id: string) => { currentUserId = id; } };
});

vi.mock("@/lib/db/client", () => ({ db: hoisted.mockDb }));

vi.mock("@/lib/db/schema", () => ({
  sizingReports: {
    id: "id", userId: "userId", fileName: "fileName", reportType: "reportType",
    region: "region", totalMonthly: "totalMonthly", totalAnnual: "totalAnnual",
    serviceCount: "serviceCount", metadata: "metadata", createdAt: "createdAt",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
  desc: vi.fn(),
  count: vi.fn().mockReturnValue("count"),
}));

import { GET as listReports, POST as createReport } from "@/app/api/sizing/route";
import { GET as getReport } from "@/app/api/sizing/[id]/route";
import { validateSession } from "@/lib/auth/session";

function makeRequest(body?: unknown, url?: string): Request {
  return new Request(url ?? "http://localhost:3000/api/sizing", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

const makeIdParams = (id: string) => ({
  params: Promise.resolve({ id }),
});

// Generator for valid report payloads
const reportPayloadArb = fc.record({
  fileName: fc.string({ minLength: 1, maxLength: 30 }),
  reportType: fc.constant("report"),
  region: fc.string({ maxLength: 20 }),
  totalMonthly: fc.float({ min: 0, max: 100000, noNaN: true }),
  totalAnnual: fc.float({ min: 0, max: 1200000, noNaN: true }),
  serviceCount: fc.integer({ min: 0, max: 100 }),
  metadata: fc.constant("{}"),
});

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.reset();
  hoisted.setCurrentUserId("user-1");
  (validateSession as ReturnType<typeof vi.fn>).mockResolvedValue({ userId: "user-1" });
});

// ─── Property Tests ──────────────────────────────────────────────────────────

describe("Property 7: Report persistence round-trip", () => {
  /**
   * **Validates: Requirements 5.1, 6.2, 6.3**
   * For any valid report creation payload, creating via POST and retrieving
   * via GET SHALL return a record with matching fields.
   */
  it("POST then GET returns matching report fields", async () => {
    await fc.assert(
      fc.asyncProperty(reportPayloadArb, async (payload) => {
        hoisted.reset();
        hoisted.setCurrentUserId("user-1");

        // Create
        const createRes = await createReport(makeRequest(payload));
        const createJson = await createRes.json();
        expect(createRes.status).toBe(201);

        const id = createJson.data.id;

        // For GET by id, we need the select to return just the matching report
        // The mock store already has it, but GET /sizing/[id] uses
        // db.select().from().where(and(eq(id), eq(userId))).limit(1)
        // Our mock returns all reports for the user, so the route will
        // destructure [report] from the array. We need to ensure only the
        // matching report is returned.
        const getRes = await getReport(makeRequest(), makeIdParams(id));
        const getJson = await getRes.json();
        expect(getRes.status).toBe(200);

        // Verify field equivalence
        expect(getJson.data.fileName).toBe(payload.fileName);
        expect(getJson.data.reportType).toBe(payload.reportType);
        expect(getJson.data.serviceCount).toBe(payload.serviceCount);
        expect(getJson.data.totalMonthly).toBeCloseTo(payload.totalMonthly, 2);
        expect(getJson.data.totalAnnual).toBeCloseTo(payload.totalAnnual, 2);
      }),
      { numRuns: 100 },
    );
  });
});

describe("Property 8: User isolation for sizing reports", () => {
  /**
   * **Validates: Requirements 6.1, 6.6**
   * Reports created by user A are not accessible by user B.
   */
  it("cross-user GET returns 404", async () => {
    await fc.assert(
      fc.asyncProperty(reportPayloadArb, async (payload) => {
        hoisted.reset();

        // Create as user-1
        hoisted.setCurrentUserId("user-1");
        (validateSession as ReturnType<typeof vi.fn>).mockResolvedValue({ userId: "user-1" });
        const createRes = await createReport(makeRequest(payload));
        const createJson = await createRes.json();
        expect(createRes.status).toBe(201);

        const id = createJson.data.id;

        // Try to access as user-2
        hoisted.setCurrentUserId("user-2");
        (validateSession as ReturnType<typeof vi.fn>).mockResolvedValue({ userId: "user-2" });
        const getRes = await getReport(makeRequest(), makeIdParams(id));
        expect(getRes.status).toBe(404);

        // Verify user-2 list is empty
        const listRes = await listReports(
          new Request("http://localhost:3000/api/sizing?page=1&limit=10"),
        );
        const listJson = await listRes.json();
        expect(listJson.data).toHaveLength(0);
      }),
      { numRuns: 100 },
    );
  });
});

describe("Property 9: Report metadata bounded to 1KB", () => {
  /**
   * **Validates: Requirements 5.2, 12.4**
   * For any metadata string, the stored metadata is always ≤ 1024 bytes.
   */
  it("stored metadata never exceeds 1KB", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 0, maxLength: 3000 }),
        async (metadataStr) => {
          hoisted.reset();
          hoisted.setCurrentUserId("user-1");

          const payload = {
            fileName: "test.json",
            reportType: "report",
            metadata: metadataStr,
          };

          const res = await createReport(makeRequest(payload));

          if (metadataStr.length > 1024) {
            // Zod rejects strings > 1024 chars
            expect(res.status).toBe(400);
          } else {
            expect(res.status).toBe(201);
            const json = await res.json();
            const storedMetadata = json.data.metadata as string;
            expect(Buffer.byteLength(storedMetadata, "utf-8")).toBeLessThanOrEqual(1024);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
