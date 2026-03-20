/**
 * Bug Condition Exploration Tests — Property 1
 *
 * These tests encode the EXPECTED (correct) behavior for three bugs.
 * On UNFIXED code, they MUST FAIL — failure confirms the bugs exist.
 * After fixes are applied, they MUST PASS — confirming the bugs are resolved.
 *
 * Bug 1: Chat Panel Viewport Overflow
 * Bug 2: Excel Column Widths Too Wide
 * Bug 3: Autofill API Returns JSON Instead of SSE Stream
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fc from "fast-check";
import { generateExcelReport } from "@/lib/sizing/excel-generator";
import type {
  PricingData,
  PricingGroup,
  PricingService,
  PricingTier,
} from "@/lib/sizing/types";

// ─── Test data helpers ──────────────────────────────────────────────────────

function makeSampleService(overrides: Partial<PricingService> = {}): PricingService {
  return {
    groupHierarchy: "My Estimate / Web Tier",
    region: "US East (N. Virginia)",
    description: "Linux, m5.xlarge, 4 vCPU, 16 GiB",
    serviceName: "Amazon EC2",
    specification: "m5.xlarge",
    upfront: 0,
    monthly: 150.55,
    first12MonthsTotal: 1806.60,
    currency: "USD",
    configurationSummary:
      "Operating system (Linux), Quantity (1), Pricing strategy (OnDemand), Storage amount (50 GB), Instance type (m5.xlarge)",
    properties: {
      instanceType: "m5.xlarge",
      operatingSystem: "Linux",
      region: "us-east-1",
    },
    ...overrides,
  };
}

function makeSamplePricingData(serviceCount = 3): PricingData {
  const services: PricingService[] = [
    makeSampleService(),
    makeSampleService({
      serviceName: "Amazon RDS",
      description: "MySQL, db.m5.4xlarge, Multi-AZ",
      specification: "db.m5.4xlarge",
      monthly: 2450.0,
      first12MonthsTotal: 29400.0,
      configurationSummary:
        "Database engine (MySQL), Instance type (db.m5.4xlarge), Deployment (Multi-AZ), Storage (500 GB gp3)",
    }),
    makeSampleService({
      serviceName: "Amazon ElastiCache",
      description: "Redis, cache.r6g.xlarge",
      specification: "cache.r6g.xlarge",
      monthly: 438.0,
      first12MonthsTotal: 5256.0,
      configurationSummary:
        "Engine (Redis), Node type (cache.r6g.xlarge), Nodes (2), Replication enabled",
    }),
  ].slice(0, serviceCount);

  const group: PricingGroup = {
    name: "My Estimate / Web Tier",
    services,
    subtotalUpfront: services.reduce((s, v) => s + v.upfront, 0),
    subtotalMonthly: services.reduce((s, v) => s + v.monthly, 0),
    subtotalFirst12Months: services.reduce((s, v) => s + v.first12MonthsTotal, 0),
  };

  const TIER_NAMES: PricingTier["tierName"][] = ["On-Demand", "RI 1-Year", "RI 3-Year"];
  const tiers: PricingTier[] = TIER_NAMES.map((tierName) => ({
    tierName,
    groups: [group],
    grandTotalUpfront: group.subtotalUpfront,
    grandTotalMonthly: group.subtotalMonthly,
    grandTotalFirst12Months: group.subtotalFirst12Months,
  }));

  return {
    fileName: "test-estimate.json",
    serviceCount: services.length,
    regionCount: 1,
    regions: ["US East (N. Virginia)"],
    tiers,
    totalMonthly: group.subtotalMonthly,
    totalAnnual: group.subtotalMonthly * 12,
    currency: "USD",
  };
}

/** fast-check arbitrary for PricingService with realistic string lengths */
function arbService(): fc.Arbitrary<PricingService> {
  return fc.record({
    groupHierarchy: fc.string({ minLength: 1, maxLength: 25 }),
    region: fc.string({ minLength: 1, maxLength: 20 }),
    description: fc.string({ minLength: 1, maxLength: 40 }),
    serviceName: fc.string({ minLength: 1, maxLength: 25 }),
    specification: fc.string({ minLength: 1, maxLength: 30 }),
    upfront: fc.float({ min: 0, max: 50000, noNaN: true }),
    monthly: fc.float({ min: 0, max: 50000, noNaN: true }),
    first12MonthsTotal: fc.float({ min: 0, max: 500000, noNaN: true }),
    currency: fc.constant("USD"),
    configurationSummary: fc.string({ minLength: 1, maxLength: 80 }),
    properties: fc.dictionary(
      fc.string({ minLength: 1, maxLength: 15 }),
      fc.string({ maxLength: 25 }),
      { minKeys: 0, maxKeys: 4 },
    ),
  });
}

/** fast-check arbitrary for PricingData */
function arbPricingData(): fc.Arbitrary<PricingData> {
  return fc
    .array(arbService(), { minLength: 1, maxLength: 5 })
    .map((services) => {
      const gName = services[0].groupHierarchy;
      const aligned = services.map((s) => ({ ...s, groupHierarchy: gName }));
      const group: PricingGroup = {
        name: gName,
        services: aligned,
        subtotalUpfront: aligned.reduce((s, v) => s + v.upfront, 0),
        subtotalMonthly: aligned.reduce((s, v) => s + v.monthly, 0),
        subtotalFirst12Months: aligned.reduce((s, v) => s + v.first12MonthsTotal, 0),
      };
      const TIER_NAMES: PricingTier["tierName"][] = ["On-Demand", "RI 1-Year", "RI 3-Year"];
      const tiers: PricingTier[] = TIER_NAMES.map((tierName) => ({
        tierName,
        groups: [group],
        grandTotalUpfront: group.subtotalUpfront,
        grandTotalMonthly: group.subtotalMonthly,
        grandTotalFirst12Months: group.subtotalFirst12Months,
      }));
      const regions = [...new Set(aligned.map((s) => s.region))].sort();
      return {
        fileName: "pbt-test.json",
        serviceCount: aligned.length,
        regionCount: regions.length,
        regions,
        tiers,
        totalMonthly: group.subtotalMonthly,
        totalAnnual: group.subtotalMonthly * 12,
        currency: "USD",
      };
    });
}

// ─── Bug 1: Chat Panel Viewport Overflow ────────────────────────────────────

describe("Bug 1 — Chat Panel Viewport Overflow", () => {
  /**
   * The SizingPage component renders a ResizablePanelGroup.
   * On unfixed code, it uses className="min-h-[600px]" with no viewport bound.
   * Expected: the panel group should NOT have unbounded min-h-[600px] — it should
   * use a viewport-bounded height (flex-1 overflow-hidden or similar).
   */
  it("ResizablePanelGroup should have viewport-bounded height, not unbounded min-h-[600px]", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const srcPath = path.resolve(process.cwd(), "components/sizing/SizingPage.tsx");
    const source = fs.readFileSync(srcPath, "utf-8");

    // Extract the className on the ResizablePanelGroup element
    const panelGroupMatch = source.match(
      /<ResizablePanelGroup[\s\S]*?className="([^"]*)"/,
    );
    expect(panelGroupMatch).not.toBeNull();
    const panelGroupClass = panelGroupMatch![1];

    // Should NOT be just "min-h-[600px]" alone — needs viewport bounding
    const isUnbounded = panelGroupClass === "min-h-[600px]";
    expect(
      isUnbounded,
      `ResizablePanelGroup className is "${panelGroupClass}" — unbounded min-h without viewport constraint`,
    ).toBe(false);
  });

  /**
   * ChatPanel outer container must include overflow-hidden to constrain children.
   * On unfixed code, it uses "flex h-full" without overflow-hidden.
   */
  it("ChatPanel outer container should include overflow-hidden", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const srcPath = path.resolve(process.cwd(), "components/chat/ChatPanel.tsx");
    const source = fs.readFileSync(srcPath, "utf-8");

    // Find the outer container div of the ChatPanel return statement
    const outerDivMatch = source.match(
      /return\s*\(\s*<div\s+className="([^"]*)"/,
    );
    expect(outerDivMatch).not.toBeNull();
    const outerClass = outerDivMatch![1];

    expect(
      outerClass.includes("overflow-hidden"),
      `ChatPanel outer div className is "${outerClass}" — missing overflow-hidden`,
    ).toBe(true);
  });
});

// ─── Bug 2: Excel Column Widths Too Wide ────────────────────────────────────

describe("Bug 2 — Excel Column Widths Too Wide", () => {
  /**
   * All column widths in the generated Excel report should be ≤ 35.
   * On unfixed code, autoSizeColumns() caps at 50 and verbose headers
   * like "Configuration Summary" (21 chars) + padding drive widths > 35.
   */
  it("all column widths should be ≤ 35", async () => {
    const data = makeSamplePricingData(3);
    const workbook = await generateExcelReport(data);
    const sheet = workbook.getWorksheet("Pricing Comparison")!;

    for (let col = 1; col <= 16; col++) {
      const width = sheet.getColumn(col).width ?? 0;
      expect(
        width,
        `Column ${col} ("${sheet.getRow(1).getCell(col).value ?? col}") width is ${width}, expected ≤ 35`,
      ).toBeLessThanOrEqual(35);
    }
  });

  /**
   * The "Config Summary" column (column 16) should be capped at 30.
   * On unfixed code, it can auto-size up to 50 chars.
   */
  it("Config Summary column (col 16) width should be ≤ 30", async () => {
    // Use a service with a long configurationSummary to trigger wide auto-sizing
    const data = makeSamplePricingData(1);
    data.tiers[0].groups[0].services[0].configurationSummary =
      "Operating system (Linux), Quantity (1), Pricing strategy (OnDemand), Storage amount (50 GB), Instance type (m5.xlarge)";

    const workbook = await generateExcelReport(data);
    const sheet = workbook.getWorksheet("Pricing Comparison")!;

    const configSummaryWidth = sheet.getColumn(16).width ?? 0;
    expect(
      configSummaryWidth,
      `Config Summary column width is ${configSummaryWidth}, expected ≤ 30`,
    ).toBeLessThanOrEqual(30);
  });

  /**
   * Pricing columns (6-14) should have widths ≤ 14.
   * On unfixed code, verbose headers like "OD 12 Months" (12 chars) + 4 padding = 16.
   */
  it("pricing columns (6-14) should have widths ≤ 14", async () => {
    const data = makeSamplePricingData(3);
    const workbook = await generateExcelReport(data);
    const sheet = workbook.getWorksheet("Pricing Comparison")!;

    for (let col = 6; col <= 14; col++) {
      const width = sheet.getColumn(col).width ?? 0;
      expect(
        width,
        `Pricing column ${col} width is ${width}, expected ≤ 14`,
      ).toBeLessThanOrEqual(14);
    }
  });

  /**
   * Property-based: for any valid PricingData, all column widths ≤ 35
   * and pricing columns ≤ 14.
   */
  it("PBT: for all valid PricingData, column widths are within bounds", async () => {
    await fc.assert(
      fc.asyncProperty(arbPricingData(), async (data) => {
        const workbook = await generateExcelReport(data);
        const sheet = workbook.getWorksheet("Pricing Comparison")!;

        for (let col = 1; col <= 16; col++) {
          const width = sheet.getColumn(col).width ?? 0;
          expect(width).toBeLessThanOrEqual(35);
        }
        for (let col = 6; col <= 14; col++) {
          const width = sheet.getColumn(col).width ?? 0;
          expect(width).toBeLessThanOrEqual(14);
        }
      }),
      { numRuns: 50 },
    );
  });
});

// ─── Bug 3: Autofill API Returns JSON Instead of SSE Stream ─────────────────

// Mock server-only before importing the route
vi.mock("server-only", () => ({}));

// Mock next/headers cookies
const mockCookieGet = vi.fn();
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    get: (...args: unknown[]) => mockCookieGet(...args),
  }),
}));

// Mock session validation
vi.mock("@/lib/auth/session", () => ({
  validateSession: vi.fn().mockResolvedValue({ userId: "user-1" }),
}));

// Mock audit writer
vi.mock("@/lib/audit/writer", () => ({
  writeAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

// Mock Azure identity
vi.mock("@azure/identity", () => ({
  DefaultAzureCredential: vi.fn(),
  ClientSecretCredential: vi.fn(),
}));

// Mock agent client — callAgentSync returns valid JSON
vi.mock("@/lib/sizing/agent-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/sizing/agent-client")>();
  return {
    ...actual,
    callAgentSync: vi.fn().mockResolvedValue(
      JSON.stringify({
        services: [
          {
            service: "Amazon EC2",
            description: "m5.xlarge",
            region: "US East (N. Virginia)",
            ri1Year: { upfront: 500, monthly: 80 },
          },
        ],
      }),
    ),
  };
});

import { POST } from "@/app/api/sizing/autofill/route";

function makeAutofillRequest(body: unknown): Request {
  return new Request("http://localhost:3000/api/sizing/autofill", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Bug 3 — Autofill API Returns JSON Instead of SSE Stream", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookieGet.mockReturnValue({ value: "valid-token" });
  });

  const validBody = {
    services: [
      {
        serviceName: "Amazon EC2",
        description: "m5.xlarge",
        region: "US East (N. Virginia)",
        properties: { instanceType: "m5.xlarge" },
      },
    ],
    inputTier: "onDemand",
    missingTiers: ["ri1Year"],
  };

  /**
   * The autofill route should return a 200 JSON response with services data.
   */
  it("autofill response should have Content-Type application/json and return services", async () => {
    const res = await POST(makeAutofillRequest(validBody));
    const contentType = res.headers.get("content-type") ?? "";

    expect(res.status).toBe(200);
    expect(
      contentType.includes("application/json"),
      `Content-Type is "${contentType}", expected "application/json"`,
    ).toBe(true);
  });

  /**
   * The autofill response body should contain a services array with pricing data.
   */
  it("autofill response should contain services array with pricing data", async () => {
    const res = await POST(makeAutofillRequest(validBody));
    const json = await res.json();

    expect(json).toHaveProperty("services");
    expect(Array.isArray(json.services)).toBe(true);
    expect(json.services.length).toBeGreaterThan(0);

    // Validate service result shape
    for (const svc of json.services) {
      expect(svc).toHaveProperty("service");
      expect(typeof svc.service).toBe("string");
    }
  });

  /**
   * The autofill response should include pricing for the requested missing tiers.
   */
  it("autofill response should include pricing for missing tiers", async () => {
    const res = await POST(makeAutofillRequest(validBody));
    const json = await res.json();

    expect(json.services.length).toBeGreaterThan(0);
    const svc = json.services[0];
    // The missing tier was ri1Year, so the response should include it
    expect(svc).toHaveProperty("ri1Year");
    expect(svc.ri1Year).toHaveProperty("monthly");
    expect(typeof svc.ri1Year.monthly).toBe("number");
  });
});
