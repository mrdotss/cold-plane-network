import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFindCorrelations, mockValidateSession } = vi.hoisted(() => ({
  mockFindCorrelations: vi.fn(),
  mockValidateSession: vi.fn(),
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

vi.mock("@/lib/insights/correlations", () => ({
  findCorrelations: mockFindCorrelations,
}));

import { GET } from "../route";

function makeRequest(params: Record<string, string> = {}): Request {
  const url = new URL("http://localhost:3000/api/insights/correlations");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new Request(url.toString(), { method: "GET" });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockValidateSession.mockResolvedValue({ userId: "user-1" });
});

describe("GET /api/insights/correlations", () => {
  it("returns correlations for valid accountId", async () => {
    mockFindCorrelations.mockResolvedValue([
      {
        resourceId: "sg-123",
        resourceName: "web-server-sg",
        service: "EC2",
        cfmRecommendation: { priority: "medium", currentCost: 150, estimatedSavings: 45 },
        cspFindings: [{ severity: "critical", finding: "SSH open", cisReference: "4.1", category: "Network" }],
      },
    ]);

    const res = await GET(makeRequest({ accountId: "acc-1" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.correlations).toHaveLength(1);
    expect(json.correlations[0].resourceId).toBe("sg-123");
    expect(mockFindCorrelations).toHaveBeenCalledWith("acc-1", "user-1");
  });

  it("returns empty array when no correlations found", async () => {
    mockFindCorrelations.mockResolvedValue([]);

    const res = await GET(makeRequest({ accountId: "acc-1" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.correlations).toHaveLength(0);
  });

  it("returns 400 when accountId is missing", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(400);
  });

  it("returns 401 when not authenticated", async () => {
    mockValidateSession.mockResolvedValue(null);

    const res = await GET(makeRequest({ accountId: "acc-1" }));
    expect(res.status).toBe(401);
  });

  it("returns 500 on internal error", async () => {
    mockFindCorrelations.mockRejectedValue(new Error("DB error"));

    const res = await GET(makeRequest({ accountId: "acc-1" }));
    expect(res.status).toBe(500);
  });
});
