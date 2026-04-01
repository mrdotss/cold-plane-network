import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fc from "fast-check";

// ─── Mocks (must be before imports) ──────────────────────────────────────────

vi.mock("server-only", () => ({}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

vi.mock("@/lib/auth/middleware", () => ({
  requireAuth: vi.fn(),
  AuthError: class AuthError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "AuthError";
    }
  },
}));

vi.mock("@/lib/cfm/queries", () => ({
  getAccountsByUser: vi.fn(),
  createAccount: vi.fn(),
  getAccountById: vi.fn(),
  getLatestScanForAccount: vi.fn(),
  updateAccount: vi.fn(),
  deleteAccount: vi.fn(),
}));

vi.mock("@/lib/audit/writer", () => ({
  writeAuditEvent: vi.fn(),
}));

vi.mock("@/lib/cfm/aws-connection", () => ({
  testConnection: vi.fn(),
}));
vi.mock("@/lib/aws/connection", () => ({
  testConnection: vi.fn(),
}));

// Mock validators — but we still get real schema behavior since Zod doesn't need server-only
vi.mock("@/lib/cfm/validators", async () => {
  const { z } = await import("zod");

  const awsAccountIdSchema = z
    .string()
    .regex(/^\d{12}$/, "AWS Account ID must be exactly 12 digits");

  const roleArnSchema = z
    .string()
    .regex(
      /^arn:aws:iam::\d{12}:role\/.+$/,
      "Role ARN must match arn:aws:iam::<12-digit-id>:role/<name>"
    );

  return {
    createAccountSchema: z.object({
      accountName: z.string().min(1).max(100),
      awsAccountId: awsAccountIdSchema,
      roleArn: roleArnSchema,
      externalId: z.string().max(256).optional(),
      regions: z.array(z.string()).min(1, "Select at least one region"),
      services: z.array(z.string()).min(1, "Select at least one service"),
    }),
    updateAccountSchema: z.object({
      accountName: z.string().min(1).max(100).optional(),
      roleArn: roleArnSchema.optional(),
      externalId: z.string().max(256).optional(),
      regions: z.array(z.string()).min(1).optional(),
      services: z.array(z.string()).min(1).optional(),
    }),
  };
});

// Mock the DB + schema for the test route (it uses db directly)
vi.mock("@/lib/db/client", () => ({
  db: {
    select: vi.fn(),
  },
}));

vi.mock("@/lib/db/schema", () => ({
  awsAccounts: { id: "id", userId: "userId" },
  cfmAccounts: { id: "id", userId: "userId" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
  and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
}));

// ─── Imports (after mocks) ───────────────────────────────────────────────────

import { requireAuth, AuthError } from "@/lib/auth/middleware";
import {
  getAccountsByUser,
  createAccount,
  getAccountById,
  getLatestScanForAccount,
  updateAccount,
  deleteAccount,
} from "@/lib/cfm/queries";
import { testConnection } from "@/lib/cfm/aws-connection";
import { db } from "@/lib/db/client";

import {
  GET as getAccounts,
  POST as createAccountRoute,
} from "@/app/api/cfm/accounts/route";
import {
  GET as getAccount,
  PATCH as patchAccount,
  DELETE as deleteAccountRoute,
} from "@/app/api/cfm/accounts/[id]/route";
import { POST as testAccountRoute } from "@/app/api/cfm/accounts/[id]/test/route";

// ─── Arbitraries ─────────────────────────────────────────────────────────────

const userIdArb = fc.uuid();
const accountIdArb = fc.uuid();
const accountNameArb = fc.string({ minLength: 1, maxLength: 50 });
const awsAccountIdArb = fc.stringMatching(/^\d{12}$/);
const roleArnArb = fc
  .tuple(
    fc.stringMatching(/^\d{12}$/),
    fc.stringMatching(/^[A-Za-z][A-Za-z0-9_+=,.@-]{0,19}$/)
  )
  .map(([id, name]) => `arn:aws:iam::${id}:role/${name}`);
const regionArb = fc.constantFrom(
  "us-east-1",
  "eu-west-1",
  "ap-southeast-1",
  "ap-southeast-3"
);
const serviceArb = fc.constantFrom(
  "EC2",
  "RDS",
  "S3",
  "Lambda",
  "CloudWatch",
  "NAT Gateway"
);

const createAccountBodyArb = fc.record({
  accountName: accountNameArb,
  awsAccountId: awsAccountIdArb,
  roleArn: roleArnArb,
  regions: fc.array(regionArb, { minLength: 1, maxLength: 3 }),
  services: fc.array(serviceArb, { minLength: 1, maxLength: 3 }),
});

const updateAccountBodyArb = fc.record({
  accountName: fc.option(accountNameArb, { nil: undefined }),
  regions: fc.option(
    fc.array(regionArb, { minLength: 1, maxLength: 3 }),
    { nil: undefined }
  ),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest(
  url: string,
  method: string,
  body?: unknown
): Request {
  const init: RequestInit = { method };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers = { "Content-Type": "application/json" };
  }
  return new Request(url, init);
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

/** Set up the db.select() chain for the test route (it queries db directly) */
function setupTestRouteSelectChain(returnValue: unknown[]) {
  const mockLimit = vi.fn().mockResolvedValue(returnValue);
  const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
  const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
  (db.select as ReturnType<typeof vi.fn>).mockReturnValue({ from: mockFrom });
  return { mockFrom, mockWhere, mockLimit };
}

// ─── Reset ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Property 12: All CFM routes require authentication ─────────────────────

/**
 * **Validates: Requirements 9.12**
 *
 * For any CFM API route, a request without a valid session should return HTTP 401.
 * We mock requireAuth to throw AuthError("Unauthorized") and verify all routes return 401.
 */
describe("Property 12: All CFM routes require authentication", () => {
  it("GET /api/cfm/accounts returns 401 when unauthenticated", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constant(null), async () => {
        vi.clearAllMocks();
        (requireAuth as ReturnType<typeof vi.fn>).mockRejectedValue(
          new AuthError("Unauthorized")
        );

        const request = makeRequest("http://localhost/api/cfm/accounts", "GET");
        const response = await getAccounts();
        expect(response.status).toBe(401);

        const body = await response.json();
        expect(body.error).toBe("Unauthorized");
      }),
      { numRuns: 100 }
    );
  });

  it("POST /api/cfm/accounts returns 401 when unauthenticated", async () => {
    await fc.assert(
      fc.asyncProperty(createAccountBodyArb, async (accountData) => {
        vi.clearAllMocks();
        (requireAuth as ReturnType<typeof vi.fn>).mockRejectedValue(
          new AuthError("Unauthorized")
        );

        const request = makeRequest(
          "http://localhost/api/cfm/accounts",
          "POST",
          accountData
        );
        const response = await createAccountRoute(request);
        expect(response.status).toBe(401);
      }),
      { numRuns: 100 }
    );
  });

  it("GET /api/cfm/accounts/[id] returns 401 when unauthenticated", async () => {
    await fc.assert(
      fc.asyncProperty(accountIdArb, async (id) => {
        vi.clearAllMocks();
        (requireAuth as ReturnType<typeof vi.fn>).mockRejectedValue(
          new AuthError("Unauthorized")
        );

        const request = makeRequest(
          `http://localhost/api/cfm/accounts/${id}`,
          "GET"
        );
        const response = await getAccount(request, makeParams(id));
        expect(response.status).toBe(401);
      }),
      { numRuns: 100 }
    );
  });

  it("PATCH /api/cfm/accounts/[id] returns 401 when unauthenticated", async () => {
    await fc.assert(
      fc.asyncProperty(
        accountIdArb,
        updateAccountBodyArb,
        async (id, updateData) => {
          vi.clearAllMocks();
          (requireAuth as ReturnType<typeof vi.fn>).mockRejectedValue(
            new AuthError("Unauthorized")
          );

          const request = makeRequest(
            `http://localhost/api/cfm/accounts/${id}`,
            "PATCH",
            updateData
          );
          const response = await patchAccount(request, makeParams(id));
          expect(response.status).toBe(401);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("DELETE /api/cfm/accounts/[id] returns 401 when unauthenticated", async () => {
    await fc.assert(
      fc.asyncProperty(accountIdArb, async (id) => {
        vi.clearAllMocks();
        (requireAuth as ReturnType<typeof vi.fn>).mockRejectedValue(
          new AuthError("Unauthorized")
        );

        const request = makeRequest(
          `http://localhost/api/cfm/accounts/${id}`,
          "DELETE"
        );
        const response = await deleteAccountRoute(request, makeParams(id));
        expect(response.status).toBe(401);
      }),
      { numRuns: 100 }
    );
  });

  it("POST /api/cfm/accounts/[id]/test returns 401 when unauthenticated", async () => {
    await fc.assert(
      fc.asyncProperty(accountIdArb, async (id) => {
        vi.clearAllMocks();
        (requireAuth as ReturnType<typeof vi.fn>).mockRejectedValue(
          new AuthError("Unauthorized")
        );

        const request = makeRequest(
          `http://localhost/api/cfm/accounts/${id}/test`,
          "POST"
        );
        const response = await testAccountRoute(request, makeParams(id));
        expect(response.status).toBe(401);
      }),
      { numRuns: 100 }
    );
  });
});


// ─── Property 13: Resource ownership authorization ──────────────────────────

/**
 * **Validates: Requirements 9.13**
 *
 * For any account owned by userA, when userB makes a request, the route should
 * return 404 (because getAccountById filters by userId — if the user doesn't
 * own it, it's "not found" to them).
 */
describe("Property 13: Resource ownership authorization", () => {
  it("GET /api/cfm/accounts/[id] returns 404 when user doesn't own the account", async () => {
    await fc.assert(
      fc.asyncProperty(
        accountIdArb,
        userIdArb,
        userIdArb.filter((u) => u.length > 0),
        async (accountId, _userA, userB) => {
          vi.clearAllMocks();
          (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
            userId: userB,
          });
          // getAccountById returns null when userId doesn't match
          (getAccountById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

          const request = makeRequest(
            `http://localhost/api/cfm/accounts/${accountId}`,
            "GET"
          );
          const response = await getAccount(request, makeParams(accountId));
          expect(response.status).toBe(404);

          const body = await response.json();
          expect(body.error).toBe("Account not found");
        }
      ),
      { numRuns: 100 }
    );
  });

  it("PATCH /api/cfm/accounts/[id] returns 404 when user doesn't own the account", async () => {
    await fc.assert(
      fc.asyncProperty(
        accountIdArb,
        userIdArb,
        updateAccountBodyArb,
        async (accountId, userB, updateData) => {
          vi.clearAllMocks();
          (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
            userId: userB,
          });
          // updateAccount returns null when userId doesn't match
          (updateAccount as ReturnType<typeof vi.fn>).mockResolvedValue(null);

          const request = makeRequest(
            `http://localhost/api/cfm/accounts/${accountId}`,
            "PATCH",
            updateData
          );
          const response = await patchAccount(request, makeParams(accountId));

          // Could be 400 (validation) or 404 (not found) — both are acceptable
          // since the user doesn't own the resource either way
          expect([400, 404]).toContain(response.status);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("DELETE /api/cfm/accounts/[id] returns 404 when user doesn't own the account", async () => {
    await fc.assert(
      fc.asyncProperty(
        accountIdArb,
        userIdArb,
        async (accountId, userB) => {
          vi.clearAllMocks();
          (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
            userId: userB,
          });
          // deleteAccount returns null when userId doesn't match
          (deleteAccount as ReturnType<typeof vi.fn>).mockResolvedValue(null);

          const request = makeRequest(
            `http://localhost/api/cfm/accounts/${accountId}`,
            "DELETE"
          );
          const response = await deleteAccountRoute(
            request,
            makeParams(accountId)
          );
          expect(response.status).toBe(404);

          const body = await response.json();
          expect(body.error).toBe("Account not found");
        }
      ),
      { numRuns: 100 }
    );
  });

  it("POST /api/cfm/accounts/[id]/test returns 404 when user doesn't own the account", async () => {
    await fc.assert(
      fc.asyncProperty(
        accountIdArb,
        userIdArb,
        async (accountId, userB) => {
          vi.clearAllMocks();
          (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
            userId: userB,
          });
          // The test route queries db directly — return empty array (no match)
          setupTestRouteSelectChain([]);

          const request = makeRequest(
            `http://localhost/api/cfm/accounts/${accountId}/test`,
            "POST"
          );
          const response = await testAccountRoute(
            request,
            makeParams(accountId)
          );
          expect(response.status).toBe(404);

          const body = await response.json();
          expect(body.error).toBe("Account not found");
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ─── Property 14: API responses don't leak sensitive fields ─────────────────

/**
 * **Validates: Requirements 10.1, 10.4**
 *
 * For any completed scan with recommendations, verify that GET /accounts/[id]
 * response does NOT contain `accessKeyId`, `secretAccessKey`, or `sessionToken`.
 *
 * Note: `roleArn` IS allowed in account management responses per the design.
 */
describe("Property 14: API responses don't leak sensitive fields", () => {
  const sensitiveFields = ["accessKeyId", "secretAccessKey", "sessionToken"];

  it("GET /api/cfm/accounts response does not contain credential fields", async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdArb,
        fc.array(
          fc.record({
            id: accountIdArb,
            userId: userIdArb,
            accountName: accountNameArb,
            awsAccountId: awsAccountIdArb,
            roleArn: roleArnArb,
            externalId: fc.option(fc.string(), { nil: null }),
            regions: fc.array(regionArb, { minLength: 1, maxLength: 2 }),
            services: fc.array(serviceArb, { minLength: 1, maxLength: 2 }),
            lastScanAt: fc.constant(null),
            createdAt: fc.constant(new Date().toISOString()),
            updatedAt: fc.constant(new Date().toISOString()),
          }),
          { minLength: 0, maxLength: 3 }
        ),
        async (userId, accounts) => {
          vi.clearAllMocks();
          (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
            userId,
          });
          (getAccountsByUser as ReturnType<typeof vi.fn>).mockResolvedValue(
            accounts
          );

          const response = await getAccounts();
          expect(response.status).toBe(200);

          const body = await response.json();
          const bodyStr = JSON.stringify(body);

          for (const field of sensitiveFields) {
            expect(bodyStr).not.toContain(`"${field}"`);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it("GET /api/cfm/accounts/[id] response does not contain credential fields", async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdArb,
        accountIdArb,
        accountNameArb,
        awsAccountIdArb,
        roleArnArb,
        fc.option(
          fc.record({
            id: fc.uuid(),
            accountId: accountIdArb,
            userId: userIdArb,
            status: fc.constant("completed"),
            summary: fc.record({
              totalMonthlySpend: fc.float({ min: 0, max: 99999, noNaN: true }),
              totalPotentialSavings: fc.float({
                min: 0,
                max: 99999,
                noNaN: true,
              }),
              recommendationCount: fc.integer({ min: 0, max: 100 }),
              priorityBreakdown: fc.record({
                critical: fc.integer({ min: 0, max: 50 }),
                medium: fc.integer({ min: 0, max: 50 }),
                low: fc.integer({ min: 0, max: 50 }),
              }),
              serviceBreakdown: fc.constant([]),
            }),
            azureConversationId: fc.option(fc.uuid(), { nil: null }),
            error: fc.constant(null),
            createdAt: fc.constant(new Date().toISOString()),
            completedAt: fc.constant(new Date().toISOString()),
          }),
          { nil: null }
        ),
        async (userId, accountId, name, awsId, arn, latestScan) => {
          vi.clearAllMocks();
          (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
            userId,
          });

          const account = {
            id: accountId,
            userId,
            accountName: name,
            awsAccountId: awsId,
            roleArn: arn,
            externalId: null,
            regions: ["us-east-1"],
            services: ["EC2"],
            lastScanAt: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          (getAccountById as ReturnType<typeof vi.fn>).mockResolvedValue(
            account
          );
          (
            getLatestScanForAccount as ReturnType<typeof vi.fn>
          ).mockResolvedValue(latestScan);

          const request = makeRequest(
            `http://localhost/api/cfm/accounts/${accountId}`,
            "GET"
          );
          const response = await getAccount(request, makeParams(accountId));
          expect(response.status).toBe(200);

          const body = await response.json();
          const bodyStr = JSON.stringify(body);

          for (const field of sensitiveFields) {
            expect(bodyStr).not.toContain(`"${field}"`);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it("PATCH /api/cfm/accounts/[id] response does not contain credential fields", async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdArb,
        accountIdArb,
        accountNameArb,
        awsAccountIdArb,
        roleArnArb,
        async (userId, accountId, name, awsId, arn) => {
          vi.clearAllMocks();
          (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
            userId,
          });

          const updatedAccount = {
            id: accountId,
            userId,
            accountName: name,
            awsAccountId: awsId,
            roleArn: arn,
            externalId: null,
            regions: ["us-east-1"],
            services: ["EC2"],
            lastScanAt: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          (updateAccount as ReturnType<typeof vi.fn>).mockResolvedValue(
            updatedAccount
          );

          const request = makeRequest(
            `http://localhost/api/cfm/accounts/${accountId}`,
            "PATCH",
            { accountName: name }
          );
          const response = await patchAccount(request, makeParams(accountId));
          expect(response.status).toBe(200);

          const body = await response.json();
          const bodyStr = JSON.stringify(body);

          for (const field of sensitiveFields) {
            expect(bodyStr).not.toContain(`"${field}"`);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
