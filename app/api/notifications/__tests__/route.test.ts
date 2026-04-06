import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoisted mocks ──────────────────────────────────────────────────────────

const {
  mockListNotifications,
  mockMarkAsRead,
  mockDismissNotifications,
  mockValidateSession,
} = vi.hoisted(() => ({
  mockListNotifications: vi.fn(),
  mockMarkAsRead: vi.fn(),
  mockDismissNotifications: vi.fn(),
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

vi.mock("@/lib/audit/writer", () => ({
  writeAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/notifications/service", () => ({
  listNotifications: mockListNotifications,
  markAsRead: mockMarkAsRead,
  dismissNotifications: mockDismissNotifications,
}));

import { GET, PATCH } from "../route";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeGetRequest(params: Record<string, string> = {}): Request {
  const url = new URL("http://localhost:3000/api/notifications");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new Request(url.toString(), { method: "GET" });
}

function makePatchRequest(body: unknown): Request {
  return new Request("http://localhost:3000/api/notifications", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const sampleNotification = {
  id: "n1",
  userId: "user-1",
  type: "cfm_scan_complete",
  title: "Scan Complete",
  body: "Your scan finished.",
  metadata: { scanId: "s1", accountId: "a1", totalSavings: 100, recommendationCount: 5 },
  readAt: null,
  createdAt: "2026-04-01T00:00:00.000Z",
};

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockValidateSession.mockResolvedValue({ userId: "user-1" });
});

// ─── GET /api/notifications ──────────────────────────────────────────────────

describe("GET /api/notifications", () => {
  it("returns paginated notifications with defaults", async () => {
    mockListNotifications.mockResolvedValue({
      notifications: [sampleNotification],
      unreadCount: 1,
      total: 1,
    });

    const res = await GET(makeGetRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.notifications).toHaveLength(1);
    expect(json.unreadCount).toBe(1);
    expect(json.total).toBe(1);
    expect(mockListNotifications).toHaveBeenCalledWith("user-1", {
      page: 1,
      limit: 20,
      unreadOnly: false,
    });
  });

  it("passes custom page and limit params", async () => {
    mockListNotifications.mockResolvedValue({
      notifications: [],
      unreadCount: 0,
      total: 0,
    });

    await GET(makeGetRequest({ page: "3", limit: "10" }));

    expect(mockListNotifications).toHaveBeenCalledWith("user-1", {
      page: 3,
      limit: 10,
      unreadOnly: false,
    });
  });

  it("passes unreadOnly=true filter", async () => {
    mockListNotifications.mockResolvedValue({
      notifications: [],
      unreadCount: 0,
      total: 0,
    });

    await GET(makeGetRequest({ unreadOnly: "true" }));

    expect(mockListNotifications).toHaveBeenCalledWith("user-1", {
      page: 1,
      limit: 20,
      unreadOnly: true,
    });
  });

  it("clamps limit to max 100", async () => {
    mockListNotifications.mockResolvedValue({
      notifications: [],
      unreadCount: 0,
      total: 0,
    });

    await GET(makeGetRequest({ limit: "500" }));

    expect(mockListNotifications).toHaveBeenCalledWith("user-1", {
      page: 1,
      limit: 100,
      unreadOnly: false,
    });
  });

  it("clamps page to min 1", async () => {
    mockListNotifications.mockResolvedValue({
      notifications: [],
      unreadCount: 0,
      total: 0,
    });

    await GET(makeGetRequest({ page: "-5" }));

    expect(mockListNotifications).toHaveBeenCalledWith("user-1", {
      page: 1,
      limit: 20,
      unreadOnly: false,
    });
  });

  it("returns 401 when not authenticated", async () => {
    mockValidateSession.mockResolvedValue(null);

    const res = await GET(makeGetRequest());

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Unauthorized");
  });
});

// ─── PATCH /api/notifications ────────────────────────────────────────────────

describe("PATCH /api/notifications", () => {
  it("marks notifications as read", async () => {
    mockMarkAsRead.mockResolvedValue(2);

    const res = await PATCH(makePatchRequest({
      ids: ["n1", "n2"],
      action: "read",
    }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.updated).toBe(2);
    expect(mockMarkAsRead).toHaveBeenCalledWith("user-1", ["n1", "n2"]);
  });

  it("dismisses notifications", async () => {
    mockDismissNotifications.mockResolvedValue(1);

    const res = await PATCH(makePatchRequest({
      ids: ["n1"],
      action: "dismiss",
    }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.updated).toBe(1);
    expect(mockDismissNotifications).toHaveBeenCalledWith("user-1", ["n1"]);
  });

  it("returns 400 for missing ids", async () => {
    const res = await PATCH(makePatchRequest({ action: "read" }));

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/ids/);
  });

  it("returns 400 for empty ids array", async () => {
    const res = await PATCH(makePatchRequest({ ids: [], action: "read" }));

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/ids/);
  });

  it("returns 400 for invalid action", async () => {
    const res = await PATCH(makePatchRequest({
      ids: ["n1"],
      action: "delete",
    }));

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/action/);
  });

  it("returns 401 when not authenticated", async () => {
    mockValidateSession.mockResolvedValue(null);

    const res = await PATCH(makePatchRequest({
      ids: ["n1"],
      action: "read",
    }));

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Unauthorized");
  });

  it("silently handles non-owned IDs (returns 0 updated)", async () => {
    mockMarkAsRead.mockResolvedValue(0);

    const res = await PATCH(makePatchRequest({
      ids: ["not-owned-id"],
      action: "read",
    }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.updated).toBe(0);
  });
});
