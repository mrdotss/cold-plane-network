import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoisted mocks
const { mockWriteAuditEvent, mockInsert, mockSelect, mockUpdate, mockDelete } =
  vi.hoisted(() => ({
    mockWriteAuditEvent: vi.fn().mockResolvedValue(undefined),
    mockInsert: vi.fn(),
    mockSelect: vi.fn(),
    mockUpdate: vi.fn(),
    mockDelete: vi.fn(),
  }));

// Mock server-only
vi.mock("server-only", () => ({}));

// Mock audit writer
vi.mock("@/lib/audit/writer", () => ({
  writeAuditEvent: mockWriteAuditEvent,
}));

// Mock DB
vi.mock("@/lib/db/client", () => ({
  db: {
    insert: (...args: unknown[]) => mockInsert(...args),
    select: (...args: unknown[]) => mockSelect(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}));

// Mock drizzle-orm operators
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_col, val) => ({ op: "eq", val })),
  and: vi.fn((...args) => ({ op: "and", args })),
  sql: vi.fn(),
  desc: vi.fn((col) => ({ op: "desc", col })),
  isNull: vi.fn((col) => ({ op: "isNull", col })),
  inArray: vi.fn((_col, vals) => ({ op: "inArray", vals })),
}));

import {
  createNotification,
  listNotifications,
  markAsRead,
  dismissNotifications,
  getUnreadCount,
} from "../service";

describe("NotificationService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── createNotification ──────────────────────────────────────────────────

  describe("createNotification", () => {
    it("inserts a notification with valid type and metadata", async () => {
      const notificationId = "notif-1";
      mockInsert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: notificationId }]),
        }),
      });

      const result = await createNotification(
        "user-1",
        "cfm_scan_complete",
        "Scan Complete",
        "Your CFM scan finished.",
        { scanId: "scan-1", accountId: "acc-1", totalSavings: 100, recommendationCount: 5 },
      );

      expect(result).toBe(notificationId);
      expect(mockInsert).toHaveBeenCalledTimes(1);
    });

    it("rejects invalid notification type", async () => {
      await expect(
        createNotification(
          "user-1",
          "invalid_type" as never,
          "Bad",
          "body",
          { scanId: "s", accountId: "a", totalSavings: 0, recommendationCount: 0 },
        ),
      ).rejects.toThrow("Invalid notification type");
    });

    it("rejects metadata exceeding 1024 bytes", async () => {
      const largeMetadata = {
        scanId: "x".repeat(1000),
        accountId: "acc-1",
        totalSavings: 0,
        recommendationCount: 0,
      };

      await expect(
        createNotification(
          "user-1",
          "cfm_scan_complete",
          "Scan Complete",
          "body",
          largeMetadata,
        ),
      ).rejects.toThrow("Metadata exceeds maximum size");
    });

    it("accepts metadata at exactly 1024 bytes", async () => {
      mockInsert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: "notif-2" }]),
        }),
      });

      // Build metadata that serializes to exactly 1024 bytes
      const base = { v: "" };
      const overhead = new TextEncoder().encode(JSON.stringify(base)).byteLength;
      const metadata = { v: "a".repeat(1024 - overhead) } as never;

      const result = await createNotification(
        "user-1",
        "cfm_scan_complete",
        "Title",
        "Body",
        metadata,
      );

      expect(result).toBe("notif-2");
    });
  });

  // ─── listNotifications ───────────────────────────────────────────────────

  describe("listNotifications", () => {
    it("returns paginated notifications with unreadCount and total", async () => {
      const mockNotifications = [
        {
          id: "n1",
          userId: "user-1",
          type: "cfm_scan_complete",
          title: "Scan Done",
          body: "Done",
          metadata: { scanId: "s1", accountId: "a1", totalSavings: 50, recommendationCount: 3 },
          readAt: null,
          createdAt: new Date("2026-04-01"),
        },
      ];

      // The select mock needs to handle 3 parallel calls
      let callCount = 0;
      mockSelect.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Main query
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    offset: vi.fn().mockResolvedValue(mockNotifications),
                  }),
                }),
              }),
            }),
          };
        }
        // Count queries
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: callCount === 2 ? 1 : 1 }]),
          }),
        };
      });

      const result = await listNotifications("user-1", { page: 1, limit: 20 });

      expect(result.notifications).toHaveLength(1);
      expect(result.notifications[0].id).toBe("n1");
      expect(result.notifications[0].readAt).toBeNull();
      expect(result.notifications[0].createdAt).toBe("2026-04-01T00:00:00.000Z");
      expect(result.total).toBe(1);
      expect(result.unreadCount).toBe(1);
    });

    it("applies unreadOnly filter when set to true", async () => {
      let callCount = 0;
      mockSelect.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    offset: vi.fn().mockResolvedValue([]),
                  }),
                }),
              }),
            }),
          };
        }
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 0 }]),
          }),
        };
      });

      const result = await listNotifications("user-1", { unreadOnly: true });

      expect(result.notifications).toHaveLength(0);
      expect(mockSelect).toHaveBeenCalledTimes(3);
    });

    it("uses default pagination values", async () => {
      let callCount = 0;
      mockSelect.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    offset: vi.fn().mockResolvedValue([]),
                  }),
                }),
              }),
            }),
          };
        }
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 0 }]),
          }),
        };
      });

      await listNotifications("user-1");
      // Should use defaults: page=1, limit=20, unreadOnly=false
      expect(mockSelect).toHaveBeenCalled();
    });
  });

  // ─── markAsRead ──────────────────────────────────────────────────────────

  describe("markAsRead", () => {
    it("updates readAt for user-owned notification IDs", async () => {
      mockUpdate.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({ rowCount: 2 }),
        }),
      });

      const result = await markAsRead("user-1", ["n1", "n2"]);

      expect(result).toBe(2);
      expect(mockUpdate).toHaveBeenCalledTimes(1);
    });

    it("returns 0 when given empty IDs array", async () => {
      const result = await markAsRead("user-1", []);
      expect(result).toBe(0);
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("only affects user-owned IDs (non-owned are silently ignored)", async () => {
      mockUpdate.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({ rowCount: 1 }),
        }),
      });

      // Pass 3 IDs but only 1 belongs to user
      const result = await markAsRead("user-1", ["n1", "n2", "n3"]);
      expect(result).toBe(1);
    });
  });

  // ─── dismissNotifications ────────────────────────────────────────────────

  describe("dismissNotifications", () => {
    it("deletes user-owned notifications and logs audit events", async () => {
      // Mock the ownership check select
      mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: "n1" }, { id: "n2" }]),
        }),
      });

      // Mock the delete
      mockDelete.mockReturnValue({
        where: vi.fn().mockResolvedValue({ rowCount: 2 }),
      });

      const result = await dismissNotifications("user-1", ["n1", "n2"]);

      expect(result).toBe(2);
      expect(mockWriteAuditEvent).toHaveBeenCalledTimes(2);
      expect(mockWriteAuditEvent).toHaveBeenCalledWith({
        userId: "user-1",
        eventType: "NOTIFICATION_DISMISSED",
        metadata: { notificationId: "n1" },
      });
      expect(mockWriteAuditEvent).toHaveBeenCalledWith({
        userId: "user-1",
        eventType: "NOTIFICATION_DISMISSED",
        metadata: { notificationId: "n2" },
      });
    });

    it("returns 0 when given empty IDs array", async () => {
      const result = await dismissNotifications("user-1", []);
      expect(result).toBe(0);
      expect(mockDelete).not.toHaveBeenCalled();
      expect(mockWriteAuditEvent).not.toHaveBeenCalled();
    });

    it("returns 0 when no IDs belong to the user", async () => {
      mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      const result = await dismissNotifications("user-1", ["n1"]);
      expect(result).toBe(0);
      expect(mockDelete).not.toHaveBeenCalled();
      expect(mockWriteAuditEvent).not.toHaveBeenCalled();
    });
  });

  // ─── getUnreadCount ──────────────────────────────────────────────────────

  describe("getUnreadCount", () => {
    it("returns the unread count for a user", async () => {
      mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 7 }]),
        }),
      });

      const count = await getUnreadCount("user-1");
      expect(count).toBe(7);
    });

    it("returns 0 when no unread notifications exist", async () => {
      mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 0 }]),
        }),
      });

      const count = await getUnreadCount("user-1");
      expect(count).toBe(0);
    });
  });
});
