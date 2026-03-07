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

// In-memory store for sizing reports
const reportStore = vi.hoisted(() => {
  const store: Record<string, unknown>[] = [];
  return {
    data: store,
    reset() { store.length = 0; },
  };
});

const mockPrisma = vi.hoisted(() => ({
  sizingReport: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
}));

vi.mock("@/lib/db/client", () => ({
  prisma: mockPrisma,
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
  reportType: fc.constantFrom("report", "recommend", "full"),
  region: fc.string({ maxLength: 20 }),
  totalMonthly: fc.float({ min: 0, max: 100000, noNaN: true }),
  totalAnnual: fc.float({ min: 0, max: 1200000, noNaN: true }),
  serviceCount: fc.integer({ min: 0, max: 100 }),
  metadata: fc.constant("{}"),
});

beforeEach(() => {
  vi.clearAllMocks();
  reportStore.reset();
  (validateSession as ReturnType<typeof vi.fn>).mockResolvedValue({ userId: "user-1" });

  // Wire up create to store and return with an id
  mockPrisma.sizingReport.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
    const report = { id: `rpt-${reportStore.data.length + 1}`, ...data, createdAt: new Date().toISOString() };
    reportStore.data.push(report);
    return report;
  });

  // Wire up findFirst to look up from store
  mockPrisma.sizingReport.findFirst.mockImplementation(async ({ where }: { where: { id: string; userId: string } }) => {
    return reportStore.data.find((r: Record<string, unknown>) => r.id === where.id && r.userId === where.userId) ?? null;
  });

  // Wire up findMany for listing
  mockPrisma.sizingReport.findMany.mockImplementation(async ({ where }: { where: { userId: string } }) => {
    return reportStore.data.filter((r: Record<string, unknown>) => r.userId === where.userId);
  });

  mockPrisma.sizingReport.count.mockImplementation(async ({ where }: { where: { userId: string } }) => {
    return reportStore.data.filter((r: Record<string, unknown>) => r.userId === where.userId).length;
  });
});

describe("Property 7: Report persistence round-trip", () => {
  /**
   * **Validates: Requirements 5.1, 6.2, 6.3**
   * For any valid report creation payload, creating via POST and retrieving
   * via GET SHALL return a record with matching fields.
   */
  it("POST then GET returns matching report fields", async () => {
    await fc.assert(
      fc.asyncProperty(reportPayloadArb, async (payload) => {
        reportStore.reset();

        // Create
        const createRes = await createReport(makeRequest(payload));
        const createJson = await createRes.json();
        expect(createRes.status).toBe(201);

        const id = createJson.data.id;

        // Retrieve
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
      { numRuns: 100 }
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
        reportStore.reset();

        // Create as user-1
        (validateSession as ReturnType<typeof vi.fn>).mockResolvedValue({ userId: "user-1" });
        const createRes = await createReport(makeRequest(payload));
        const createJson = await createRes.json();
        expect(createRes.status).toBe(201);

        const id = createJson.data.id;

        // Try to access as user-2
        (validateSession as ReturnType<typeof vi.fn>).mockResolvedValue({ userId: "user-2" });
        const getRes = await getReport(makeRequest(), makeIdParams(id));
        expect(getRes.status).toBe(404);

        // Verify user-2 list is empty
        const listRes = await listReports(
          new Request("http://localhost:3000/api/sizing?page=1&limit=10")
        );
        const listJson = await listRes.json();
        expect(listJson.data).toHaveLength(0);
      }),
      { numRuns: 100 }
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
          reportStore.reset();

          const payload = {
            fileName: "test.json",
            reportType: "report",
            metadata: metadataStr,
          };

          // The Zod schema caps metadata at 1024 chars.
          // If metadata > 1024 chars, POST should reject with 400.
          // If metadata ≤ 1024 chars, stored metadata should be ≤ 1024 bytes.
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
        }
      ),
      { numRuns: 100 }
    );
  });
});
