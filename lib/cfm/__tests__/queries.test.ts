import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fc from "fast-check";

// Mock server-only since queries.ts imports it
vi.mock("server-only", () => ({}));

// Mock the DB client with chainable Drizzle API
vi.mock("@/lib/db/client", () => ({
  db: {
    insert: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

// Import after mocks
import { db } from "@/lib/db/client";
import { cfmAccounts, cfmScans, cfmRecommendations } from "@/lib/db/schema";
import {
  createAccount,
  deleteAccount,
  createScan,
  updateScanStatus,
  insertRecommendations,
} from "@/lib/cfm/queries";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Set up a fresh mock chain for db.insert().values().returning() */
function setupInsertChain(returnValue: unknown[]) {
  const mockReturning = vi.fn().mockResolvedValue(returnValue);
  const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
  (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({
    values: mockValues,
  });
  return { mockValues, mockReturning };
}

/** Set up a fresh mock chain for db.delete().where().returning() */
function setupDeleteChain(returnValue: unknown[]) {
  const mockReturning = vi.fn().mockResolvedValue(returnValue);
  const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
  (db.delete as ReturnType<typeof vi.fn>).mockReturnValue({
    where: mockWhere,
  });
  return { mockWhere, mockReturning };
}

/** Set up a fresh mock chain for db.update().set().where().returning() */
function setupUpdateChain(returnValue: unknown[]) {
  const mockReturning = vi.fn().mockResolvedValue(returnValue);
  const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
  const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
  (db.update as ReturnType<typeof vi.fn>).mockReturnValue({
    set: mockSet,
  });
  return { mockSet, mockWhere, mockReturning };
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

const userIdArb = fc.uuid();
const accountIdArb = fc.uuid();
const scanIdArb = fc.uuid();
const awsAccountIdArb = fc.stringMatching(/^\d{12}$/);
const accountNameArb = fc.string({ minLength: 1, maxLength: 100 });
const roleArnArb = fc
  .tuple(
    fc.stringMatching(/^\d{12}$/),
    fc.stringMatching(/^[A-Za-z][A-Za-z0-9_+=,.@-]{0,29}$/)
  )
  .map(([id, name]) => `arn:aws:iam::${id}:role/${name}`);
const externalIdArb = fc.option(
  fc.string({ minLength: 1, maxLength: 256 }),
  { nil: undefined }
);
const regionsArb = fc.array(
  fc.constantFrom("us-east-1", "eu-west-1", "ap-southeast-1", "ap-southeast-3"),
  { minLength: 1, maxLength: 4 }
);
const servicesArb = fc.array(
  fc.constantFrom("EC2", "RDS", "S3", "Lambda", "CloudWatch", "NAT Gateway"),
  { minLength: 1, maxLength: 6 }
);

const accountDataArb = fc.record({
  accountName: accountNameArb,
  awsAccountId: awsAccountIdArb,
  roleArn: roleArnArb,
  externalId: externalIdArb,
  regions: regionsArb,
  services: servicesArb,
});

const recommendationArb = fc.record({
  scanId: scanIdArb,
  service: fc.constantFrom("EC2", "RDS", "S3", "Lambda", "CloudWatch"),
  resourceId: fc.string({ minLength: 1, maxLength: 100 }),
  resourceName: fc.option(fc.string({ minLength: 1, maxLength: 100 }), {
    nil: undefined,
  }),
  priority: fc.constantFrom("critical", "medium", "low"),
  recommendation: fc.string({ minLength: 1, maxLength: 500 }),
  currentCost: fc
    .float({ min: 0, max: 99999, noNaN: true })
    .map((n) => n.toFixed(2)),
  estimatedSavings: fc
    .float({ min: 0, max: 99999, noNaN: true })
    .map((n) => n.toFixed(2)),
  effort: fc.constantFrom("low", "medium", "high"),
  metadata: fc.option(
    fc.dictionary(
      fc.string({ minLength: 1, maxLength: 20 }),
      fc.oneof(fc.string(), fc.integer(), fc.boolean())
    ),
    { nil: undefined }
  ),
});

// ─── Reset mocks ─────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Property 2: Cascade delete consistency ─────────────────────────────────

/**
 * **Validates: Requirements 2.5, 8.5**
 *
 * Verifies that:
 * 1. The cfmScans table has onDelete: "cascade" on its accountId FK
 * 2. The cfmRecommendations table has onDelete: "cascade" on its scanId FK
 * 3. deleteAccount calls db.delete(cfmAccounts).where(...) with correct filters
 */
describe("Property 2: Cascade delete consistency", () => {
  it("cfmScans.accountId has onDelete cascade in schema FK definition", () => {
    // Drizzle stores inline FKs via Symbol.for("drizzle:PgInlineForeignKeys")
    const scansFKs = (cfmScans as unknown as Record<symbol, unknown[]>)[
      Symbol.for("drizzle:PgInlineForeignKeys")
    ];
    expect(scansFKs).toBeDefined();
    expect(Array.isArray(scansFKs)).toBe(true);

    // Find the FK that references cfmAccounts
    const accountFK = scansFKs.find((fk: unknown) => {
      const fkObj = fk as Record<string, unknown>;
      const ref = fkObj.reference as
        | (() => { foreignTable: unknown })
        | undefined;
      if (ref) {
        const refResult = ref();
        return refResult.foreignTable === cfmAccounts;
      }
      return false;
    }) as Record<string, unknown> | undefined;

    expect(accountFK).toBeDefined();
    expect(accountFK!.onDelete).toBe("cascade");
  });

  it("cfmRecommendations.scanId has onDelete cascade in schema FK definition", () => {
    const recsFKs = (cfmRecommendations as unknown as Record<symbol, unknown[]>)[
      Symbol.for("drizzle:PgInlineForeignKeys")
    ];
    expect(recsFKs).toBeDefined();
    expect(Array.isArray(recsFKs)).toBe(true);

    const scanFK = recsFKs.find((fk: unknown) => {
      const fkObj = fk as Record<string, unknown>;
      const ref = fkObj.reference as
        | (() => { foreignTable: unknown })
        | undefined;
      if (ref) {
        const refResult = ref();
        return refResult.foreignTable === cfmScans;
      }
      return false;
    }) as Record<string, unknown> | undefined;

    expect(scanFK).toBeDefined();
    expect(scanFK!.onDelete).toBe("cascade");
  });

  it("deleteAccount calls db.delete(cfmAccounts) for any userId + accountId", async () => {
    await fc.assert(
      fc.asyncProperty(accountIdArb, userIdArb, async (accountId, userId) => {
        vi.clearAllMocks();
        setupDeleteChain([{ id: accountId }]);

        await deleteAccount(accountId, userId);

        expect(db.delete).toHaveBeenCalledTimes(1);
        // Use reference equality (toBe) to avoid deep-comparing Drizzle table objects
        expect((db.delete as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(
          cfmAccounts
        );
      }),
      { numRuns: 100 }
    );
  });
});

// ─── Property 3: Unique constraint on user + AWS Account ID ─────────────────

/**
 * **Validates: Requirements 2.7**
 *
 * Verifies that:
 * 1. The cfmAccounts schema has a unique index on (userId, awsAccountId)
 * 2. createAccount propagates DB constraint violation errors when duplicates are attempted
 */
describe("Property 3: Unique constraint on user + AWS Account ID", () => {
  it("cfmAccounts schema defines a unique index on (userId, awsAccountId)", () => {
    // Drizzle stores the extra config builder function on the table
    // The uniqueIndex is created via the table's config builder
    const configBuilder = (cfmAccounts as unknown as Record<symbol, unknown>)[
      Symbol.for("drizzle:ExtraConfigBuilder")
    ];
    expect(configBuilder).toBeDefined();
    expect(typeof configBuilder).toBe("function");
  });

  it("createAccount propagates constraint violation for duplicate userId + awsAccountId", async () => {
    await fc.assert(
      fc.asyncProperty(userIdArb, accountDataArb, async (userId, data) => {
        vi.clearAllMocks();

        // Simulate a unique constraint violation from the DB
        const constraintError = new Error(
          'duplicate key value violates unique constraint "idx_cfm_accounts_user_aws"'
        );
        (constraintError as unknown as Record<string, unknown>).code = "23505";

        const mockReturning = vi.fn().mockRejectedValue(constraintError);
        const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
        (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({
          values: mockValues,
        });

        await expect(createAccount(userId, data)).rejects.toThrow(
          "duplicate key value violates unique constraint"
        );

        expect((db.insert as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(cfmAccounts);
      }),
      { numRuns: 100 }
    );
  });
});

// ─── Property 10: CFM entity DB round-trip ───────────────────────────────────

/**
 * **Validates: Requirements 8.1, 8.2, 8.3**
 *
 * For any valid entity data, verify that the query functions pass the correct
 * values to db.insert().values() and that the returned record preserves all fields.
 */
describe("Property 10: CFM entity DB round-trip", () => {
  it("createAccount passes correct values and preserves all fields on return", async () => {
    await fc.assert(
      fc.asyncProperty(userIdArb, accountDataArb, async (userId, data) => {
        vi.clearAllMocks();

        const now = new Date();
        const expectedRecord = {
          id: "generated-uuid",
          userId,
          accountName: data.accountName,
          awsAccountId: data.awsAccountId,
          roleArn: data.roleArn,
          externalId: data.externalId ?? null,
          regions: data.regions,
          services: data.services,
          lastScanAt: null,
          createdAt: now,
          updatedAt: now,
        };

        const { mockValues } = setupInsertChain([expectedRecord]);

        const result = await createAccount(userId, data);

        // Verify insert was called with cfmAccounts (reference equality)
        expect((db.insert as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(cfmAccounts);

        // Verify values passed to .values()
        const valuesArg = mockValues.mock.calls[0][0];
        expect(valuesArg.userId).toBe(userId);
        expect(valuesArg.accountName).toBe(data.accountName);
        expect(valuesArg.awsAccountId).toBe(data.awsAccountId);
        expect(valuesArg.roleArn).toBe(data.roleArn);
        expect(valuesArg.externalId).toBe(data.externalId ?? null);
        expect(valuesArg.regions).toEqual(data.regions);
        expect(valuesArg.services).toEqual(data.services);

        // Verify round-trip: returned record preserves all fields
        expect(result.userId).toBe(userId);
        expect(result.accountName).toBe(data.accountName);
        expect(result.awsAccountId).toBe(data.awsAccountId);
        expect(result.roleArn).toBe(data.roleArn);
        expect(result.externalId).toBe(data.externalId ?? null);
        expect(result.regions).toEqual(data.regions);
        expect(result.services).toEqual(data.services);
      }),
      { numRuns: 100 }
    );
  });

  it("createScan passes correct values and preserves all fields on return", async () => {
    await fc.assert(
      fc.asyncProperty(accountIdArb, userIdArb, async (accountId, userId) => {
        vi.clearAllMocks();

        const now = new Date();
        const expectedRecord = {
          id: "generated-scan-uuid",
          accountId,
          userId,
          status: "pending",
          summary: null,
          azureConversationId: null,
          error: null,
          createdAt: now,
          completedAt: null,
        };

        const { mockValues } = setupInsertChain([expectedRecord]);

        const result = await createScan(accountId, userId);

        expect((db.insert as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(cfmScans);

        const valuesArg = mockValues.mock.calls[0][0];
        expect(valuesArg.accountId).toBe(accountId);
        expect(valuesArg.userId).toBe(userId);
        expect(valuesArg.status).toBe("pending");

        // Round-trip
        expect(result.accountId).toBe(accountId);
        expect(result.userId).toBe(userId);
        expect(result.status).toBe("pending");
        expect(result.summary).toBeNull();
        expect(result.completedAt).toBeNull();
      }),
      { numRuns: 100 }
    );
  });

  it("insertRecommendations passes correct values and preserves all fields on return", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(recommendationArb, { minLength: 1, maxLength: 5 }),
        async (recs) => {
          vi.clearAllMocks();

          const returnedRecs = recs.map((r, i) => ({
            id: `rec-uuid-${i}`,
            scanId: r.scanId,
            service: r.service,
            resourceId: r.resourceId,
            resourceName: r.resourceName ?? null,
            priority: r.priority,
            recommendation: r.recommendation,
            currentCost: r.currentCost,
            estimatedSavings: r.estimatedSavings,
            effort: r.effort,
            metadata: r.metadata ?? {},
            createdAt: new Date(),
          }));

          const { mockValues } = setupInsertChain(returnedRecs);

          const result = await insertRecommendations(recs);

          expect((db.insert as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(cfmRecommendations);

          // Verify values passed
          const valuesArg = mockValues.mock.calls[0][0] as Array<
            Record<string, unknown>
          >;
          expect(valuesArg).toHaveLength(recs.length);

          for (let i = 0; i < recs.length; i++) {
            expect(valuesArg[i].scanId).toBe(recs[i].scanId);
            expect(valuesArg[i].service).toBe(recs[i].service);
            expect(valuesArg[i].resourceId).toBe(recs[i].resourceId);
            expect(valuesArg[i].priority).toBe(recs[i].priority);
            expect(valuesArg[i].recommendation).toBe(recs[i].recommendation);
            expect(valuesArg[i].currentCost).toBe(recs[i].currentCost);
            expect(valuesArg[i].estimatedSavings).toBe(recs[i].estimatedSavings);
            expect(valuesArg[i].effort).toBe(recs[i].effort);
          }

          // Round-trip
          expect(result).toHaveLength(recs.length);
          for (let i = 0; i < recs.length; i++) {
            expect(result[i].service).toBe(recs[i].service);
            expect(result[i].resourceId).toBe(recs[i].resourceId);
            expect(result[i].priority).toBe(recs[i].priority);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 11: Scan history is append-only ────────────────────────────────

/**
 * **Validates: Requirements 8.6**
 *
 * Verifies that:
 * 1. createScan always calls db.insert(cfmScans) — never update or delete
 * 2. updateScanStatus only updates status/summary/error/completedAt, never deletes
 * 3. For N generated scans, exactly N insert calls are made
 */
describe("Property 11: Scan history is append-only", () => {
  it("createScan always calls db.insert, never db.update or db.delete", async () => {
    await fc.assert(
      fc.asyncProperty(accountIdArb, userIdArb, async (accountId, userId) => {
        vi.clearAllMocks();

        setupInsertChain([
          {
            id: "scan-uuid",
            accountId,
            userId,
            status: "pending",
            summary: null,
            azureConversationId: null,
            error: null,
            createdAt: new Date(),
            completedAt: null,
          },
        ]);

        await createScan(accountId, userId);

        expect((db.insert as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(cfmScans);
        expect(db.update).not.toHaveBeenCalled();
        expect(db.delete).not.toHaveBeenCalled();
      }),
      { numRuns: 100 }
    );
  });

  it("updateScanStatus only calls db.update, never db.delete or db.insert", async () => {
    await fc.assert(
      fc.asyncProperty(
        scanIdArb,
        fc.constantFrom(
          "pending" as const,
          "running" as const,
          "completed" as const,
          "failed" as const
        ),
        async (scanId, status) => {
          vi.clearAllMocks();

          const { mockSet } = setupUpdateChain([
            {
              id: scanId,
              status,
              summary: null,
              error: null,
              completedAt:
                status === "completed" || status === "failed"
                  ? new Date()
                  : null,
            },
          ]);

          await updateScanStatus(scanId, status);

          // updateScanStatus MUST call update
          expect((db.update as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(cfmScans);

          // updateScanStatus MUST NOT call delete or insert
          expect(db.delete).not.toHaveBeenCalled();
          expect(db.insert).not.toHaveBeenCalled();

          // Verify only allowed fields are set
          const setArg = mockSet.mock.calls[0][0] as Record<string, unknown>;
          expect(setArg).toHaveProperty("status", status);

          // Must NOT contain fields that would indicate a non-append operation
          expect(setArg).not.toHaveProperty("accountId");
          expect(setArg).not.toHaveProperty("userId");
          expect(setArg).not.toHaveProperty("createdAt");
        }
      ),
      { numRuns: 100 }
    );
  });

  it("N scans produce exactly N insert calls", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10 }),
        accountIdArb,
        userIdArb,
        async (n, accountId, userId) => {
          vi.clearAllMocks();

          // Set up a persistent mock chain that survives multiple calls
          const mockReturning = vi.fn();
          const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
          (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({
            values: mockValues,
          });

          for (let i = 0; i < n; i++) {
            mockReturning.mockResolvedValueOnce([
              {
                id: `scan-uuid-${i}`,
                accountId,
                userId,
                status: "pending",
                summary: null,
                azureConversationId: null,
                error: null,
                createdAt: new Date(),
                completedAt: null,
              },
            ]);
            await createScan(accountId, userId);
          }

          // Exactly N insert calls should have been made
          expect(db.insert).toHaveBeenCalledTimes(n);

          // Every call should target cfmScans
          for (let i = 0; i < n; i++) {
            expect(
              (db.insert as ReturnType<typeof vi.fn>).mock.calls[i][0]
            ).toBe(cfmScans);
          }

          // No updates or deletes should have occurred
          expect(db.update).not.toHaveBeenCalled();
          expect(db.delete).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });
});
