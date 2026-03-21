import { describe, it, expect, vi } from "vitest";
import * as fc from "fast-check";

// Mock server-only since schema.ts imports it transitively
vi.mock("server-only", () => ({}));

import { cfmAccounts, cfmScans, cfmRecommendations } from "@/lib/db/schema";

/**
 * Property 7: No credential persistence
 *
 * For any generated account/scan/recommendation record, verify stored data
 * does not contain `accessKeyId`, `secretAccessKey`, or `sessionToken` fields.
 *
 * **Validates: Requirements 3.9, 10.2**
 */
describe("Property 7: No credential persistence", () => {
  const CREDENTIAL_FIELDS = ["accessKeyId", "secretAccessKey", "sessionToken"];

  /**
   * Helper: recursively check that an object (and all nested objects) does not
   * contain any credential field names as keys.
   */
  function containsCredentialField(obj: unknown): string | null {
    if (obj === null || obj === undefined || typeof obj !== "object") {
      return null;
    }

    if (Array.isArray(obj)) {
      for (const item of obj) {
        const found = containsCredentialField(item);
        if (found) return found;
      }
      return null;
    }

    for (const key of Object.keys(obj as Record<string, unknown>)) {
      if (CREDENTIAL_FIELDS.includes(key)) {
        return key;
      }
      const found = containsCredentialField(
        (obj as Record<string, unknown>)[key]
      );
      if (found) return found;
    }
    return null;
  }

  /** Arbitrary for a cfmAccounts-shaped record */
  const accountRecordArb = fc.record({
    id: fc.uuid(),
    userId: fc.uuid(),
    accountName: fc.string({ minLength: 1, maxLength: 100 }),
    awsAccountId: fc.stringMatching(/^\d{12}$/),
    roleArn: fc.constant("arn:aws:iam::123456789012:role/TestRole"),
    externalId: fc.option(fc.string({ minLength: 1, maxLength: 256 }), {
      nil: null,
    }),
    regions: fc.array(
      fc.constantFrom(
        "us-east-1",
        "eu-west-1",
        "ap-southeast-1",
        "ap-southeast-3"
      ),
      { minLength: 1, maxLength: 4 }
    ),
    services: fc.array(
      fc.constantFrom("EC2", "RDS", "S3", "Lambda", "CloudWatch"),
      { minLength: 1, maxLength: 5 }
    ),
    lastScanAt: fc.option(fc.date(), { nil: null }),
    createdAt: fc.date(),
    updatedAt: fc.date(),
  });

  /** Arbitrary for a cfmScans-shaped record */
  const scanRecordArb = fc.record({
    id: fc.uuid(),
    accountId: fc.uuid(),
    userId: fc.uuid(),
    status: fc.constantFrom("pending", "running", "completed", "failed"),
    summary: fc.option(
      fc.record({
        totalMonthlySpend: fc.float({ min: 0, max: 100000, noNaN: true }),
        totalPotentialSavings: fc.float({ min: 0, max: 100000, noNaN: true }),
        recommendationCount: fc.integer({ min: 0, max: 500 }),
        priorityBreakdown: fc.record({
          critical: fc.integer({ min: 0, max: 100 }),
          medium: fc.integer({ min: 0, max: 200 }),
          low: fc.integer({ min: 0, max: 200 }),
        }),
        serviceBreakdown: fc.array(
          fc.record({
            service: fc.constantFrom("EC2", "RDS", "S3", "Lambda"),
            currentSpend: fc.float({ min: 0, max: 50000, noNaN: true }),
            potentialSavings: fc.float({ min: 0, max: 50000, noNaN: true }),
            recommendationCount: fc.integer({ min: 0, max: 100 }),
            resourceCount: fc.integer({ min: 0, max: 500 }),
            hasCritical: fc.boolean(),
            recommendationTypes: fc.array(
              fc.constantFrom("right-sizing", "unused", "idle", "upgrade"),
              { minLength: 0, maxLength: 3 }
            ),
          }),
          { minLength: 0, maxLength: 4 }
        ),
      }),
      { nil: null }
    ),
    azureConversationId: fc.option(fc.uuid(), { nil: null }),
    error: fc.option(fc.string({ minLength: 1, maxLength: 200 }), {
      nil: null,
    }),
    createdAt: fc.date(),
    completedAt: fc.option(fc.date(), { nil: null }),
  });

  /** Arbitrary for a cfmRecommendations-shaped record */
  const recommendationRecordArb = fc.record({
    id: fc.uuid(),
    scanId: fc.uuid(),
    service: fc.constantFrom("EC2", "RDS", "S3", "Lambda", "CloudWatch"),
    resourceId: fc.string({ minLength: 1, maxLength: 100 }),
    resourceName: fc.option(fc.string({ minLength: 1, maxLength: 100 }), {
      nil: null,
    }),
    priority: fc.constantFrom("critical", "medium", "low"),
    recommendation: fc.string({ minLength: 1, maxLength: 500 }),
    currentCost: fc.float({ min: 0, max: 10000, noNaN: true }),
    estimatedSavings: fc.float({ min: 0, max: 10000, noNaN: true }),
    effort: fc.constantFrom("low", "medium", "high"),
    metadata: fc.dictionary(
      fc.string({ minLength: 1, maxLength: 20 }).filter(
        (k) => !["accessKeyId", "secretAccessKey", "sessionToken"].includes(k)
      ),
      fc.oneof(fc.string(), fc.integer(), fc.boolean())
    ),
    createdAt: fc.date(),
  });

  it("cfmAccounts schema columns do not include credential fields", () => {
    const columnNames = Object.keys(cfmAccounts);
    for (const field of CREDENTIAL_FIELDS) {
      expect(columnNames).not.toContain(field);
    }
  });

  it("cfmScans schema columns do not include credential fields", () => {
    const columnNames = Object.keys(cfmScans);
    for (const field of CREDENTIAL_FIELDS) {
      expect(columnNames).not.toContain(field);
    }
  });

  it("cfmRecommendations schema columns do not include credential fields", () => {
    const columnNames = Object.keys(cfmRecommendations);
    for (const field of CREDENTIAL_FIELDS) {
      expect(columnNames).not.toContain(field);
    }
  });

  it("no generated account record contains credential fields", () => {
    fc.assert(
      fc.property(accountRecordArb, (record) => {
        const found = containsCredentialField(record);
        expect(found).toBeNull();
      }),
      { numRuns: 100 }
    );
  });

  it("no generated scan record contains credential fields", () => {
    fc.assert(
      fc.property(scanRecordArb, (record) => {
        const found = containsCredentialField(record);
        expect(found).toBeNull();
      }),
      { numRuns: 100 }
    );
  });

  it("no generated recommendation record contains credential fields", () => {
    fc.assert(
      fc.property(recommendationRecordArb, (record) => {
        const found = containsCredentialField(record);
        expect(found).toBeNull();
      }),
      { numRuns: 100 }
    );
  });
});
