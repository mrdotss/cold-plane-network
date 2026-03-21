import { describe, it, expect, vi } from "vitest";
import * as fc from "fast-check";

// Mock server-only since export-generator imports it
vi.mock("server-only", () => ({}));

import { generateExcel } from "@/lib/cfm/export-generator";
import type {
  CfmScan,
  CfmAccount,
  CfmRecommendation,
  CfmPriority,
  CfmEffort,
  CfmScanSummary,
} from "@/lib/cfm/types";

// ─── Arbitraries ─────────────────────────────────────────────────────────────

const SERVICES = ["EC2", "RDS", "S3", "Lambda", "CloudWatch", "NAT Gateway", "ECS"];
const PRIORITIES: CfmPriority[] = ["critical", "medium", "low"];
const EFFORTS: CfmEffort[] = ["low", "medium", "high"];

/**
 * Build a scan fixture for the given services.
 */
function makeScan(scanId: string, services: string[]): CfmScan {
  const summary: CfmScanSummary = {
    totalMonthlySpend: 10000,
    totalPotentialSavings: 2500,
    recommendationCount: 10,
    priorityBreakdown: { critical: 2, medium: 5, low: 3 },
    serviceBreakdown: services.map((svc) => ({
      service: svc,
      currentSpend: 1000,
      potentialSavings: 250,
      recommendationCount: 2,
      resourceCount: 5,
      hasCritical: false,
      recommendationTypes: ["right-sizing"],
    })),
  };

  return {
    id: scanId,
    accountId: "acc-001",
    userId: "user-001",
    status: "completed",
    summary,
    azureConversationId: "conv-001",
    error: null,
    createdAt: new Date(),
    completedAt: new Date(),
  };
}

const MOCK_ACCOUNT: CfmAccount = {
  id: "acc-001",
  userId: "user-001",
  accountName: "Test Account",
  awsAccountId: "123456789012",
  roleArn: "arn:aws:iam::123456789012:role/TestRole",
  externalId: null,
  regions: ["us-east-1"],
  services: ["EC2", "RDS"],
  lastScanAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ─── Property 9: Excel export contains all required sheets ───────────────────

describe("Property 9: Excel export contains all required sheets", () => {
  /**
   * For any completed scan with recommendations across N distinct services,
   * the workbook contains exactly N + 2 sheets:
   *   1 Executive Summary + N per-service + 1 Prioritized Action Plan
   *
   * Validates: Requirements 7.2
   */
  it("workbook has exactly N+2 sheets for N distinct services", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate 1–6 unique services
        fc.shuffledSubarray(SERVICES, { minLength: 1, maxLength: 6 }),
        async (services) => {
          const scanId = "scan-prop9";
          const scan = makeScan(scanId, services);

          // Build recommendations covering all services
          const recs: CfmRecommendation[] = services.map((svc, i) => ({
            id: `rec-${i}`,
            scanId,
            service: svc,
            resourceId: `res-${i}`,
            resourceName: `Resource ${i}`,
            priority: PRIORITIES[i % 3],
            recommendation: `Optimize ${svc} resource`,
            currentCost: 100 + i * 10,
            estimatedSavings: 20 + i * 5,
            effort: EFFORTS[i % 3],
            metadata: {},
            createdAt: new Date(),
          }));

          const workbook = await generateExcel(scan, MOCK_ACCOUNT, recs);
          const sheetNames = workbook.worksheets.map((ws) => ws.name);

          // Exactly N + 2 sheets
          expect(sheetNames.length).toBe(services.length + 2);

          // First sheet is Executive Summary
          expect(sheetNames[0]).toBe("Executive Summary");

          // Last sheet is Prioritized Action Plan
          expect(sheetNames[sheetNames.length - 1]).toBe("Prioritized Action Plan");

          // Middle sheets are the service names (sorted)
          const serviceSheets = sheetNames.slice(1, -1);
          const sortedServices = [...services].sort();
          expect(serviceSheets).toEqual(sortedServices);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("Prioritized Action Plan sorts recommendations by savings descending", async () => {
    const scan = makeScan("scan-sort", ["EC2", "S3"]);
    const recs: CfmRecommendation[] = [
      {
        id: "r1", scanId: "scan-sort", service: "EC2", resourceId: "i-001",
        resourceName: "Web Server", priority: "low", recommendation: "Downsize",
        currentCost: 200, estimatedSavings: 50, effort: "low", metadata: {}, createdAt: new Date(),
      },
      {
        id: "r2", scanId: "scan-sort", service: "S3", resourceId: "bucket-1",
        resourceName: "Logs", priority: "critical", recommendation: "Change class",
        currentCost: 500, estimatedSavings: 300, effort: "medium", metadata: {}, createdAt: new Date(),
      },
      {
        id: "r3", scanId: "scan-sort", service: "EC2", resourceId: "i-002",
        resourceName: "API Server", priority: "medium", recommendation: "Right-size",
        currentCost: 300, estimatedSavings: 100, effort: "low", metadata: {}, createdAt: new Date(),
      },
    ];

    const workbook = await generateExcel(scan, MOCK_ACCOUNT, recs);
    const actionPlan = workbook.getWorksheet("Prioritized Action Plan");
    expect(actionPlan).toBeDefined();

    // Row 1 is header, data starts at row 2
    // Column 5 is Monthly Savings
    const savings: number[] = [];
    actionPlan!.eachRow({ includeEmpty: false }, (row, rowNum) => {
      if (rowNum === 1) return; // skip header
      const val = row.getCell(5).value;
      if (typeof val === "number") savings.push(val);
    });

    expect(savings).toEqual([300, 100, 50]);
  });

  it("critical priority rows get conditional formatting fill", async () => {
    const scan = makeScan("scan-crit", ["EC2"]);
    const recs: CfmRecommendation[] = [
      {
        id: "r1", scanId: "scan-crit", service: "EC2", resourceId: "i-001",
        resourceName: null, priority: "critical", recommendation: "Stop instance",
        currentCost: 500, estimatedSavings: 500, effort: "low", metadata: {}, createdAt: new Date(),
      },
      {
        id: "r2", scanId: "scan-crit", service: "EC2", resourceId: "i-002",
        resourceName: null, priority: "low", recommendation: "Right-size",
        currentCost: 100, estimatedSavings: 20, effort: "low", metadata: {}, createdAt: new Date(),
      },
    ];

    const workbook = await generateExcel(scan, MOCK_ACCOUNT, recs);
    const ec2Sheet = workbook.getWorksheet("EC2");
    expect(ec2Sheet).toBeDefined();

    // Row 2 is critical, row 3 is low
    const criticalFill = ec2Sheet!.getRow(2).getCell(1).fill;
    const lowFill = ec2Sheet!.getRow(3).getCell(1).fill;

    // Critical row should have the pink/red fill
    expect(criticalFill).toMatchObject({
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFCE4EC" },
    });

    // Low row should NOT have the critical fill
    if (lowFill && "fgColor" in lowFill) {
      expect(lowFill.fgColor?.argb).not.toBe("FFFCE4EC");
    }
  });
});
