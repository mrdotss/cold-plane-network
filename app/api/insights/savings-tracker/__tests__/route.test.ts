import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockValidateSession, mockDbSelect } = vi.hoisted(() => ({
  mockValidateSession: vi.fn(),
  mockDbSelect: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue({ value: "valid-token" }),
  }),
}));

vi.mock("@/lib/auth/session", () => ({
  validateSession: mockValidateSession,
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
  desc: vi.fn(),
  sql: vi.fn(),
}));

function chainable(resolveValue: unknown) {
  const obj: Record<string, unknown> = {};
  for (const m of ["from", "where", "orderBy", "limit", "innerJoin"]) {
    obj[m] = vi.fn().mockReturnValue(obj);
  }
  obj.then = (resolve: (v: unknown) => void) => resolve(resolveValue);
  return obj;
}

let selectCallCount = 0;

vi.mock("@/lib/db/client", () => ({
  db: {
    select: (..._args: unknown[]) => mockDbSelect(),
  },
}));

vi.mock("@/lib/db/schema", () => ({
  cfmRecommendationTracking: {},
  cfmRecommendations: {},
  cfmScans: {},
  awsAccounts: { userId: "userId", id: "id" },
}));

import { GET } from "../route";

beforeEach(() => {
  vi.clearAllMocks();
  selectCallCount = 0;
  mockValidateSession.mockResolvedValue({ userId: "user-1" });
});

describe("GET /api/insights/savings-tracker", () => {
  it("returns tracked items and summary", async () => {
    mockDbSelect.mockImplementation(() => {
      selectCallCount++;
      if (selectCallCount === 1) {
        // accounts query
        return chainable([{ id: "acc-1" }]);
      }
      // tracking records query
      return chainable([
        {
          trackingId: "t1",
          accountId: "acc-1",
          resourceId: "i-abc",
          service: "EC2",
          expectedSavings: "73.00",
          actualSavings: "68.00",
          verificationStatus: "confirmed",
          implementedAt: new Date("2026-03-15"),
          verifiedAt: new Date("2026-03-22"),
        },
      ]);
    });

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.tracked).toHaveLength(1);
    expect(json.tracked[0].resourceId).toBe("i-abc");
    expect(json.tracked[0].verificationStatus).toBe("confirmed");
    expect(json.summary.totalExpectedSavings).toBe(73);
    expect(json.summary.totalActualSavings).toBe(68);
  });

  it("returns empty when no accounts", async () => {
    mockDbSelect.mockImplementation(() => chainable([]));

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.tracked).toHaveLength(0);
    expect(json.summary.totalExpectedSavings).toBe(0);
  });

  it("returns empty when no implemented recommendations", async () => {
    mockDbSelect.mockImplementation(() => {
      selectCallCount++;
      if (selectCallCount === 1) return chainable([{ id: "acc-1" }]);
      return chainable([]);
    });

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.tracked).toHaveLength(0);
  });

  it("returns 401 when not authenticated", async () => {
    mockValidateSession.mockResolvedValue(null);

    const res = await GET();
    expect(res.status).toBe(401);
  });
});
