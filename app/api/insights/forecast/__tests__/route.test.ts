import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockComputeForecast, mockValidateSession } = vi.hoisted(() => ({
  mockComputeForecast: vi.fn(),
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

vi.mock("@/lib/insights/forecast", () => ({
  computeForecast: mockComputeForecast,
}));

import { GET } from "../route";

function makeRequest(params: Record<string, string> = {}): Request {
  const url = new URL("http://localhost:3000/api/insights/forecast");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new Request(url.toString(), { method: "GET" });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockValidateSession.mockResolvedValue({ userId: "user-1" });
});

describe("GET /api/insights/forecast", () => {
  it("returns forecast data for valid params", async () => {
    mockComputeForecast.mockResolvedValue({
      history: [{ date: "2026-03-01", value: 4200 }],
      forecast: [{ date: "2026-04-01", value: 4500 }],
      trend: "up",
      changePercent: 7.1,
    });

    const res = await GET(makeRequest({ accountId: "acc-1", metric: "spend" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.trend).toBe("up");
    expect(json.history).toHaveLength(1);
    expect(json.forecast).toHaveLength(1);
    expect(mockComputeForecast).toHaveBeenCalledWith("acc-1", "user-1", "spend", 30);
  });

  it("passes custom horizon", async () => {
    mockComputeForecast.mockResolvedValue({
      history: [],
      forecast: [],
      trend: "stable",
      changePercent: 0,
      message: "Not enough data for forecasting",
    });

    await GET(makeRequest({ accountId: "acc-1", metric: "security_score", horizon: "90" }));

    expect(mockComputeForecast).toHaveBeenCalledWith("acc-1", "user-1", "security_score", 90);
  });

  it("returns 400 when accountId is missing", async () => {
    const res = await GET(makeRequest({ metric: "spend" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("accountId");
  });

  it("returns 400 for invalid metric", async () => {
    const res = await GET(makeRequest({ accountId: "acc-1", metric: "invalid" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Invalid metric");
  });

  it("returns 401 when not authenticated", async () => {
    mockValidateSession.mockResolvedValue(null);

    const res = await GET(makeRequest({ accountId: "acc-1", metric: "spend" }));
    expect(res.status).toBe(401);
  });

  it("returns insufficient data message", async () => {
    mockComputeForecast.mockResolvedValue({
      history: [{ date: "2026-03-01", value: 4200 }],
      forecast: [],
      trend: "stable",
      changePercent: 0,
      message: "Not enough data for forecasting",
    });

    const res = await GET(makeRequest({ accountId: "acc-1", metric: "spend" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.message).toBe("Not enough data for forecasting");
    expect(json.forecast).toHaveLength(0);
  });
});
