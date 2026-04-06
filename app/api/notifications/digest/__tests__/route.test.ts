import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGenerateDigest, mockValidateSession } = vi.hoisted(() => ({
  mockGenerateDigest: vi.fn(),
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

vi.mock("@/lib/notifications/digest", () => ({
  generateDigest: mockGenerateDigest,
}));

import { POST } from "../route";

function makeRequest(body?: unknown): Request {
  return new Request("http://localhost:3000/api/notifications/digest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockValidateSession.mockResolvedValue({ userId: "user-1" });
});

describe("POST /api/notifications/digest", () => {
  it("triggers digest generation and returns notificationId", async () => {
    mockGenerateDigest.mockResolvedValue({
      notificationId: "notif-1",
      accountCount: 3,
      excludedCount: 0,
    });

    const res = await POST(makeRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.notificationId).toBe("notif-1");
    expect(mockGenerateDigest).toHaveBeenCalledWith("user-1", undefined);
  });

  it("passes accountIds filter when provided", async () => {
    mockGenerateDigest.mockResolvedValue({
      notificationId: "notif-2",
      accountCount: 1,
      excludedCount: 0,
    });

    const res = await POST(makeRequest({ accountIds: ["acc-1", "acc-2"] }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.notificationId).toBe("notif-2");
    expect(mockGenerateDigest).toHaveBeenCalledWith("user-1", ["acc-1", "acc-2"]);
  });

  it("handles empty body gracefully (defaults to all accounts)", async () => {
    mockGenerateDigest.mockResolvedValue({
      notificationId: "notif-3",
      accountCount: 2,
      excludedCount: 0,
    });

    const res = await POST(
      new Request("http://localhost:3000/api/notifications/digest", {
        method: "POST",
      }),
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(mockGenerateDigest).toHaveBeenCalledWith("user-1", undefined);
  });

  it("returns 401 when not authenticated", async () => {
    mockValidateSession.mockResolvedValue(null);

    const res = await POST(makeRequest());

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 500 when digest generation fails", async () => {
    mockGenerateDigest.mockRejectedValue(new Error("DB error"));

    const res = await POST(makeRequest());

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Failed to generate digest");
  });
});
