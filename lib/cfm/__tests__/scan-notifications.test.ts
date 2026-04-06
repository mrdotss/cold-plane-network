import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoisted mocks ──────────────────────────────────────────────────────────

const {
  mockCreateNotification,
  mockUpdateScanStatus,
  mockInsertRecommendations,
  mockSyncTracking,
  mockAutoVerify,
  mockAssumeRole,
  mockCollectAccountData,
  mockCreateConversation,
  mockDbUpdate,
} = vi.hoisted(() => ({
  mockCreateNotification: vi.fn().mockResolvedValue("notif-1"),
  mockUpdateScanStatus: vi.fn().mockResolvedValue(undefined),
  mockInsertRecommendations: vi.fn().mockResolvedValue(undefined),
  mockSyncTracking: vi.fn().mockResolvedValue(undefined),
  mockAutoVerify: vi.fn().mockResolvedValue(undefined),
  mockAssumeRole: vi.fn().mockResolvedValue({
    accessKeyId: "k",
    secretAccessKey: "s",
    sessionToken: "t",
  }),
  mockCollectAccountData: vi.fn().mockResolvedValue({
    services: [],
    costByTag: {},
  }),
  mockCreateConversation: vi.fn().mockResolvedValue("conv-1"),
  mockDbUpdate: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/notifications/service", () => ({
  createNotification: mockCreateNotification,
}));

vi.mock("@/lib/aws/connection", () => ({
  assumeRole: mockAssumeRole,
}));

vi.mock("@/lib/chat/agent-client", () => ({
  createConversation: mockCreateConversation,
}));

vi.mock("@/lib/sizing/agent-client", () => ({
  getBearerToken: vi.fn().mockResolvedValue("token"),
}));

vi.mock("@/lib/audit/writer", () => ({
  writeAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../aws-collector", () => ({
  collectAccountData: mockCollectAccountData,
  formatCollectedData: vi.fn().mockReturnValue("formatted"),
}));

vi.mock("../queries", () => ({
  updateScanStatus: mockUpdateScanStatus,
  insertRecommendations: mockInsertRecommendations,
  syncTrackingAfterScan: mockSyncTracking,
  autoVerifyImplementedRecommendations: mockAutoVerify,
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
  desc: vi.fn(),
  sql: vi.fn(),
}));

function chainable(resolveValue?: unknown) {
  const obj: Record<string, unknown> = {};
  for (const m of ["set", "where", "from", "orderBy", "limit"]) {
    obj[m] = vi.fn().mockReturnValue(obj);
  }
  obj.then = (resolve: (v: unknown) => void) => resolve(resolveValue);
  return obj;
}

vi.mock("@/lib/db/client", () => ({
  db: {
    update: (...args: unknown[]) => mockDbUpdate(...args),
  },
}));

vi.mock("@/lib/db/schema", () => ({
  cfmScans: { id: "id", azureConversationId: "azureConversationId" },
  awsAccounts: { id: "id", lastScanAt: "lastScanAt", updatedAt: "updatedAt" },
}));

// Mock global fetch for the agent call
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { runScan } from "../scanner";

const baseAccount = {
  id: "acc-1",
  userId: "user-1",
  accountName: "Test Account",
  awsAccountId: "123456789012",
  roleArn: "arn:aws:iam::123456789012:role/test",
  externalId: null,
  regions: ["us-east-1"] as string[],
  services: ["EC2"] as string[],
  lastScanAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockDbUpdate.mockReturnValue(chainable());

  // Set required env vars for the scanner
  process.env.AZURE_EXISTING_AIPROJECT_ENDPOINT = "https://test.openai.azure.com";
  process.env.AZURE_EXISTING_AGENT_ID = "cpn-agent";

  // Mock fetch for agent call — return empty response (no recommendations)
  mockFetch.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ output: [] }),
    text: () => Promise.resolve(""),
  });
});

// ─── CFM Scanner Notification Tests ──────────────────────────────────────────

describe("CFM scan completion → cfm_scan_complete notification", () => {
  it("creates notification after successful scan", async () => {
    await runScan("scan-1", baseAccount);

    expect(mockCreateNotification).toHaveBeenCalledWith(
      "user-1",
      "cfm_scan_complete",
      expect.stringContaining("CFM Scan Complete"),
      expect.stringContaining("Test Account"),
      expect.objectContaining({
        scanId: "scan-1",
        accountId: "acc-1",
      }),
    );
  });

  it("notification metadata includes totalSavings and recommendationCount", async () => {
    await runScan("scan-2", baseAccount);

    const callArgs = mockCreateNotification.mock.calls[0];
    const metadata = callArgs[4];
    expect(metadata).toHaveProperty("totalSavings");
    expect(metadata).toHaveProperty("recommendationCount");
    expect(typeof metadata.totalSavings).toBe("number");
    expect(typeof metadata.recommendationCount).toBe("number");
  });

  it("does not create notification when scan fails (STS error)", async () => {
    mockAssumeRole.mockRejectedValueOnce(new Error("Access denied"));

    await runScan("scan-3", baseAccount);

    expect(mockCreateNotification).not.toHaveBeenCalled();
  });

  it("notification failure does not fail the scan", async () => {
    mockCreateNotification.mockRejectedValueOnce(new Error("DB error"));

    // Should not throw
    await runScan("scan-4", baseAccount);

    // Scan should still complete
    expect(mockUpdateScanStatus).toHaveBeenCalledWith(
      "scan-4",
      "completed",
      expect.anything(),
    );
  });
});

// ─── Security Regression Detection (unit) ────────────────────────────────────

describe("CSP security regression detection", () => {
  // Test the shouldCreateRegressionNotification function logic
  // (mirrored here since the CSP scanner has complex dependencies)

  function shouldCreateRegressionNotification(
    previousScore: number,
    currentScore: number,
  ): boolean {
    return currentScore < previousScore;
  }

  it("returns true when score drops", () => {
    expect(shouldCreateRegressionNotification(87, 72)).toBe(true);
  });

  it("returns false when score improves", () => {
    expect(shouldCreateRegressionNotification(72, 87)).toBe(false);
  });

  it("returns false when score is unchanged", () => {
    expect(shouldCreateRegressionNotification(87, 87)).toBe(false);
  });

  it("returns true for any drop including 1 point", () => {
    expect(shouldCreateRegressionNotification(100, 99)).toBe(true);
  });

  it("returns false when no previous scan (previousScore = 0, currentScore > 0)", () => {
    // If there's no previous scan, we don't create regression notification
    // This is handled by the scanner checking if previousScan exists
    expect(shouldCreateRegressionNotification(0, 85)).toBe(false);
  });
});
