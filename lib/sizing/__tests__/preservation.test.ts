/**
 * Preservation Property Tests — Property 2
 *
 * These tests capture the BASELINE behavior of UNFIXED code for non-buggy inputs.
 * They MUST PASS on unfixed code — confirming behavior to preserve after fixes.
 *
 * Bug 1 Preservation: Panel Resizing and Independent Scrolling
 * Bug 2 Preservation: Excel Data Integrity and Formatting
 * Bug 3 Preservation: Non-Streaming Paths and Agent Client
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11**
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fc from "fast-check";
import { generateExcelReport, generateFullAnalysisReport } from "@/lib/sizing/excel-generator";
import { mergePricingData, isRiEligible } from "@/lib/sizing/merge";
import type {
  PricingData,
  PricingGroup,
  PricingService,
  PricingTier,
  AutofillResponse,
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
    first12MonthsTotal: 1806.6,
    currency: "USD",
    configurationSummary:
      "Operating system (Linux), Quantity (1), Instance type (m5.xlarge)",
    properties: { instanceType: "m5.xlarge", operatingSystem: "Linux" },
    ...overrides,
  };
}

function makePricingData(services: PricingService[]): PricingData {
  const group: PricingGroup = {
    name: services[0]?.groupHierarchy ?? "Default",
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

/** fast-check arbitrary for PricingService with constrained string lengths */
function arbService(): fc.Arbitrary<PricingService> {
  return fc.record({
    groupHierarchy: fc.string({ minLength: 1, maxLength: 20 }),
    region: fc.string({ minLength: 1, maxLength: 18 }),
    description: fc.string({ minLength: 1, maxLength: 30 }),
    serviceName: fc.string({ minLength: 1, maxLength: 22 }),
    specification: fc.string({ minLength: 1, maxLength: 16 }),
    upfront: fc.float({ min: Math.fround(0), max: Math.fround(99999), noNaN: true }),
    monthly: fc.float({ min: Math.fround(0.01), max: Math.fround(99999), noNaN: true }),
    first12MonthsTotal: fc.float({ min: Math.fround(0), max: Math.fround(999999), noNaN: true }),
    currency: fc.constant("USD"),
    configurationSummary: fc.string({ minLength: 1, maxLength: 60 }),
    properties: fc.dictionary(
      fc.string({ minLength: 1, maxLength: 12 }),
      fc.string({ maxLength: 20 }),
      { minKeys: 0, maxKeys: 3 },
    ),
  });
}

/** fast-check arbitrary for PricingData with 1-4 services */
function arbPricingData(): fc.Arbitrary<PricingData> {
  return fc
    .array(arbService(), { minLength: 1, maxLength: 4 })
    .map((services) => {
      const gName = services[0].groupHierarchy;
      const aligned = services.map((s) => ({ ...s, groupHierarchy: gName }));
      return makePricingData(aligned);
    });
}

// ─── Bug 1 Preservation: Panel Resizing and Independent Scrolling ───────────

describe("Bug 1 Preservation — Panel Resizing and Independent Scrolling", () => {
  /**
   * **Validates: Requirements 3.2**
   * ResizablePanelGroup renders with orientation="horizontal",
   * default sizes 45/55, min sizes 30, and ResizableHandle with withHandle.
   */
  it("SizingPage preserves ResizablePanelGroup props: orientation, defaultSize, minSize", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const srcPath = path.resolve(process.cwd(), "components/sizing/SizingPage.tsx");
    const source = fs.readFileSync(srcPath, "utf-8");

    // orientation="horizontal"
    expect(source).toContain('orientation="horizontal"');

    // defaultSize={45} and defaultSize={55}
    expect(source).toMatch(/defaultSize=\{45\}/);
    expect(source).toMatch(/defaultSize=\{55\}/);

    // minSize={30} (at least two panels with minSize 30)
    const minSizeMatches = source.match(/minSize=\{30\}/g);
    expect(minSizeMatches).not.toBeNull();
    expect(minSizeMatches!.length).toBeGreaterThanOrEqual(2);

    // ResizableHandle with withHandle prop
    expect(source).toMatch(/<ResizableHandle\s+withHandle/);
  });

  /**
   * **Validates: Requirements 3.1**
   * ReportPanel container has overflow-y-auto for independent scrolling.
   */
  it("ReportPanel container preserves overflow-y-auto for independent scrolling", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const srcPath = path.resolve(process.cwd(), "components/sizing/SizingPage.tsx");
    const source = fs.readFileSync(srcPath, "utf-8");

    // The left panel wraps ReportPanel in a div with overflow-y-auto
    expect(source).toContain("overflow-y-auto");
  });

  /**
   * **Validates: Requirements 3.3**
   * Chat sidebar toggle uses w-52 width.
   */
  it("ChatPanel sidebar preserves w-52 width", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const srcPath = path.resolve(process.cwd(), "components/chat/ChatPanel.tsx");
    const source = fs.readFileSync(srcPath, "utf-8");

    // Sidebar container has w-52
    expect(source).toContain("w-52");
  });

  /**
   * **Validates: Requirements 3.3**
   * PBT: for all panel configurations, the structural props are preserved.
   * We verify the source file always contains the required layout props.
   */
  it("PBT: panel layout props are consistently present across reads", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        (_iteration) => {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const fs = require("fs");
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const path = require("path");
          const srcPath = path.resolve(process.cwd(), "components/sizing/SizingPage.tsx");
          const source = fs.readFileSync(srcPath, "utf-8");

          // Structural invariants that must always hold
          expect(source).toContain('orientation="horizontal"');
          expect(source).toMatch(/defaultSize=\{45\}/);
          expect(source).toMatch(/defaultSize=\{55\}/);
          expect(source).toMatch(/minSize=\{30\}/);
          expect(source).toMatch(/<ResizableHandle/);
          expect(source).toContain("overflow-y-auto");
        },
      ),
      { numRuns: 5 },
    );
  });
});

// ─── Bug 2 Preservation: Excel Data Integrity and Formatting ────────────────

describe("Bug 2 Preservation — Excel Data Integrity and Formatting", () => {
  /**
   * **Validates: Requirements 3.4**
   * Data cell values (pricing numbers, service names, regions) are correct.
   */
  it("data cell values match input PricingData", async () => {
    const svc1 = makeSampleService();
    const svc2 = makeSampleService({
      serviceName: "Amazon RDS",
      description: "MySQL, db.m5.4xlarge",
      specification: "db.m5.4xlarge",
      monthly: 2450.0,
      first12MonthsTotal: 29400.0,
    });
    const data = makePricingData([svc1, svc2]);
    const workbook = await generateExcelReport(data);
    const sheet = workbook.getWorksheet("Pricing Comparison")!;

    // Find the header row to determine where data starts
    let headerRowNum = 0;
    sheet.eachRow((row, rowNumber) => {
      if (row.getCell(1).value === "Group Hierarchy") {
        headerRowNum = rowNumber;
      }
    });
    expect(headerRowNum).toBeGreaterThan(0);

    // First data row is right after header
    const dataRow1 = sheet.getRow(headerRowNum + 1);
    expect(dataRow1.getCell(1).value).toBe(svc1.groupHierarchy);
    expect(dataRow1.getCell(2).value).toBe(svc1.region);
    expect(dataRow1.getCell(3).value).toBe(svc1.description);
    expect(dataRow1.getCell(4).value).toBe(svc1.serviceName);
    expect(dataRow1.getCell(5).value).toBe(svc1.specification);
    expect(dataRow1.getCell(6).value).toBe(svc1.upfront);
    expect(dataRow1.getCell(7).value).toBe(svc1.monthly);
    expect(dataRow1.getCell(8).value).toBe(svc1.first12MonthsTotal);
    expect(dataRow1.getCell(15).value).toBe(svc1.currency);
    expect(dataRow1.getCell(16).value).toBe(svc1.configurationSummary);

    // Second data row
    const dataRow2 = sheet.getRow(headerRowNum + 2);
    expect(dataRow2.getCell(4).value).toBe(svc2.serviceName);
    expect(dataRow2.getCell(7).value).toBe(svc2.monthly);
  });

  /**
   * **Validates: Requirements 3.5**
   * Subtotal rows have bold font and thick borders.
   */
  it("subtotal rows have bold font and thick borders", async () => {
    const data = makePricingData([makeSampleService()]);
    const workbook = await generateExcelReport(data);
    const sheet = workbook.getWorksheet("Pricing Comparison")!;

    // Find the subtotal row (contains "Subtotal" in cell 1)
    let subtotalRow: import("exceljs").Row | null = null;
    sheet.eachRow((row) => {
      const val = String(row.getCell(1).value ?? "");
      if (val.includes("Subtotal")) {
        subtotalRow = row;
      }
    });
    expect(subtotalRow).not.toBeNull();

    // Bold font
    expect(subtotalRow!.font?.bold).toBe(true);

    // Thick (medium) borders on cells
    const cell1Border = subtotalRow!.getCell(1).border;
    expect(cell1Border?.top?.style).toBe("medium");
    expect(cell1Border?.bottom?.style).toBe("medium");
  });

  /**
   * **Validates: Requirements 3.5**
   * Grand total row has bold font, green fill (TOTAL_FILL), and thick borders.
   */
  it("grand total row has bold font, green fill, and thick borders", async () => {
    const data = makePricingData([makeSampleService()]);
    const workbook = await generateExcelReport(data);
    const sheet = workbook.getWorksheet("Pricing Comparison")!;

    // Find the grand total row
    let grandTotalRow: import("exceljs").Row | null = null;
    sheet.eachRow((row) => {
      if (row.getCell(1).value === "Grand Total") {
        grandTotalRow = row;
      }
    });
    expect(grandTotalRow).not.toBeNull();

    // Bold font
    expect(grandTotalRow!.font?.bold).toBe(true);

    // TOTAL_FILL: green fill with argb FFE2EFDA
    const fill = grandTotalRow!.fill as import("exceljs").FillPattern;
    expect(fill?.type).toBe("pattern");
    expect(fill?.fgColor?.argb).toBe("FFE2EFDA");

    // Thick borders
    const cellBorder = grandTotalRow!.getCell(1).border;
    expect(cellBorder?.top?.style).toBe("medium");
    expect(cellBorder?.bottom?.style).toBe("medium");
  });

  /**
   * **Validates: Requirements 3.5**
   * Currency columns use #,##0.00 format.
   */
  it("currency columns use #,##0.00 format", async () => {
    const data = makePricingData([makeSampleService()]);
    const workbook = await generateExcelReport(data);
    const sheet = workbook.getWorksheet("Pricing Comparison")!;

    // Find first data row
    let headerRowNum = 0;
    sheet.eachRow((row, rowNumber) => {
      if (row.getCell(1).value === "Group Hierarchy") {
        headerRowNum = rowNumber;
      }
    });
    const dataRow = sheet.getRow(headerRowNum + 1);

    // Currency columns: 6-14
    const CURRENCY_COLS = [6, 7, 8, 9, 10, 11, 12, 13, 14];
    for (const col of CURRENCY_COLS) {
      expect(dataRow.getCell(col).numFmt).toBe("#,##0.00");
    }
  });

  /**
   * **Validates: Requirements 3.6**
   * RI-ineligible footnotes are present for non-RI services.
   */
  it("RI-ineligible footnotes are present for non-RI services", async () => {
    const s3Service = makeSampleService({
      serviceName: "Amazon S3",
      description: "S3 Standard Storage",
      specification: "Standard",
      monthly: 23.0,
      first12MonthsTotal: 276.0,
    });
    const data = makePricingData([makeSampleService(), s3Service]);
    const workbook = await generateExcelReport(data);
    const sheet = workbook.getWorksheet("Pricing Comparison")!;

    // Find the RI-Ineligible footnote
    let footnoteFound = false;
    sheet.eachRow((row) => {
      const val = String(row.getCell(1).value ?? "");
      if (val.includes("RI-Ineligible") || val.includes("do not support Reserved Instance")) {
        footnoteFound = true;
      }
    });
    expect(footnoteFound).toBe(true);
  });

  /**
   * **Validates: Requirements 3.6**
   * Conditional formatting: green fill applied when RI monthly < 70% of OD monthly.
   */
  it("conditional formatting applies green fill for >30% RI savings", async () => {
    // Build data with distinct tier pricing to trigger conditional formatting.
    // The OD tier has high monthly, RI tiers have lower monthly.
    // We must create separate service objects per tier to avoid shared references.
    const odService: PricingService = {
      ...makeSampleService(),
      monthly: 1000,
      first12MonthsTotal: 12000,
    };
    const ri1Service: PricingService = {
      ...makeSampleService(),
      monthly: 500, // 50% of OD → qualifies for green fill (< 70%)
      first12MonthsTotal: 6000,
    };
    const ri3Service: PricingService = {
      ...makeSampleService(),
      monthly: 300, // 30% of OD → qualifies for green fill
      first12MonthsTotal: 3600,
    };

    const makeGroup = (svcs: PricingService[]): PricingGroup => ({
      name: svcs[0].groupHierarchy,
      services: svcs,
      subtotalUpfront: svcs.reduce((s, v) => s + v.upfront, 0),
      subtotalMonthly: svcs.reduce((s, v) => s + v.monthly, 0),
      subtotalFirst12Months: svcs.reduce((s, v) => s + v.first12MonthsTotal, 0),
    });

    const data: PricingData = {
      fileName: "test.json",
      serviceCount: 1,
      regionCount: 1,
      regions: ["US East (N. Virginia)"],
      tiers: [
        {
          tierName: "On-Demand",
          groups: [makeGroup([odService])],
          grandTotalUpfront: 0,
          grandTotalMonthly: 1000,
          grandTotalFirst12Months: 12000,
        },
        {
          tierName: "RI 1-Year",
          groups: [makeGroup([ri1Service])],
          grandTotalUpfront: 0,
          grandTotalMonthly: 500,
          grandTotalFirst12Months: 6000,
        },
        {
          tierName: "RI 3-Year",
          groups: [makeGroup([ri3Service])],
          grandTotalUpfront: 0,
          grandTotalMonthly: 300,
          grandTotalFirst12Months: 3600,
        },
      ],
      totalMonthly: 1000,
      totalAnnual: 12000,
      currency: "USD",
    };

    const workbook = await generateExcelReport(data);
    const sheet = workbook.getWorksheet("Pricing Comparison")!;

    // Find the data row
    let headerRowNum = 0;
    sheet.eachRow((row, rowNumber) => {
      if (row.getCell(1).value === "Group Hierarchy") {
        headerRowNum = rowNumber;
      }
    });
    const dataRow = sheet.getRow(headerRowNum + 1);

    // Column 10 is RI 1Y Monthly — should have green fill (FFC6EFCE)
    const ri1MonthlyFill = dataRow.getCell(10).fill as import("exceljs").FillPattern;
    expect(ri1MonthlyFill?.type).toBe("pattern");
    expect(ri1MonthlyFill?.fgColor?.argb).toBe("FFC6EFCE");

    // Column 13 is RI 3Y Monthly — should also have green fill
    const ri3MonthlyFill = dataRow.getCell(13).fill as import("exceljs").FillPattern;
    expect(ri3MonthlyFill?.type).toBe("pattern");
    expect(ri3MonthlyFill?.fgColor?.argb).toBe("FFC6EFCE");
  });

  /**
   * **Validates: Requirements 3.7**
   * generateFullAnalysisReport() appends agent notes section correctly.
   */
  it("generateFullAnalysisReport appends agent notes section", async () => {
    const data = makePricingData([makeSampleService()]);
    const agentNotes = "Consider using Savings Plans for EC2 workloads.";
    const workbook = await generateFullAnalysisReport(data, agentNotes);
    const sheet = workbook.getWorksheet("Pricing Comparison")!;

    // Find the AI Recommendations header
    let notesHeaderFound = false;
    let notesContentFound = false;
    sheet.eachRow((row) => {
      const val = String(row.getCell(1).value ?? "");
      if (val === "AI Recommendations") {
        notesHeaderFound = true;
      }
      if (val.includes("Consider using Savings Plans")) {
        notesContentFound = true;
      }
    });
    expect(notesHeaderFound).toBe(true);
    expect(notesContentFound).toBe(true);
  });

  /**
   * **Validates: Requirements 3.4, 3.5, 3.6**
   * PBT: for all valid PricingData, data cell values, subtotal/grand total formatting,
   * currency format, and footnotes are preserved.
   */
  it("PBT: for all valid PricingData, data integrity and formatting are preserved", async () => {
    await fc.assert(
      fc.asyncProperty(arbPricingData(), async (data) => {
        const workbook = await generateExcelReport(data);
        const sheet = workbook.getWorksheet("Pricing Comparison")!;

        // Find header row
        let headerRowNum = 0;
        sheet.eachRow((row, rowNumber) => {
          if (row.getCell(1).value === "Group Hierarchy") {
            headerRowNum = rowNumber;
          }
        });
        expect(headerRowNum).toBeGreaterThan(0);

        // Verify data rows match input services
        const services = data.tiers[0].groups[0].services;
        for (let i = 0; i < services.length; i++) {
          const row = sheet.getRow(headerRowNum + 1 + i);
          expect(row.getCell(4).value).toBe(services[i].serviceName);
          expect(row.getCell(2).value).toBe(services[i].region);
          expect(row.getCell(7).value).toBe(services[i].monthly);

          // Currency format on pricing columns
          for (const col of [6, 7, 8, 9, 10, 11, 12, 13, 14]) {
            expect(row.getCell(col).numFmt).toBe("#,##0.00");
          }
        }

        // Grand total row exists with bold font and TOTAL_FILL
        let grandTotalFound = false;
        sheet.eachRow((row) => {
          if (row.getCell(1).value === "Grand Total") {
            grandTotalFound = true;
            expect(row.font?.bold).toBe(true);
            const fill = row.fill as import("exceljs").FillPattern;
            expect(fill?.fgColor?.argb).toBe("FFE2EFDA");
          }
        });
        expect(grandTotalFound).toBe(true);

        // Subtotal row exists with bold font
        let subtotalFound = false;
        sheet.eachRow((row) => {
          const val = String(row.getCell(1).value ?? "");
          if (val.includes("Subtotal")) {
            subtotalFound = true;
            expect(row.font?.bold).toBe(true);
          }
        });
        expect(subtotalFound).toBe(true);
      }),
      { numRuns: 30 },
    );
  });
});

// ─── Bug 3 Preservation: Non-Streaming Paths and Agent Client ───────────────

// Mock server-only before importing server modules
vi.mock("server-only", () => ({}));

// Mock Azure identity
vi.mock("@azure/identity", () => ({
  DefaultAzureCredential: vi.fn(),
  ClientSecretCredential: vi.fn(),
}));

describe("Bug 3 Preservation — Non-Streaming Paths and Agent Client", () => {
  /**
   * **Validates: Requirements 3.10**
   * callAgentSync makes a non-streaming POST with store: false and returns a string.
   */
  it("callAgentSync makes a non-streaming POST with store: false", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const srcPath = path.resolve(process.cwd(), "lib/sizing/agent-client.ts");
    const source = fs.readFileSync(srcPath, "utf-8");

    // callAgentSync should call agentFetch with store: false
    // Extract the callAgentSync function body
    const fnMatch = source.match(
      /export async function callAgentSync[\s\S]*?^}/m,
    );
    expect(fnMatch).not.toBeNull();
    const fnBody = fnMatch![0];

    // Must use agentFetch (which does POST)
    expect(fnBody).toContain("agentFetch");

    // Must pass store: false
    expect(fnBody).toContain("store: false");

    // Must NOT pass stream: true (non-streaming)
    expect(fnBody).not.toContain("stream: true");
    expect(fnBody).not.toContain("stream:true");

    // Return type is string (function returns string)
    expect(source).toMatch(/callAgentSync[\s\S]*?:\s*Promise<string>/);
  });

  /**
   * **Validates: Requirements 3.10**
   * agentFetch uses POST method with correct headers.
   */
  it("agentFetch uses POST method with Content-Type and Authorization headers", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const srcPath = path.resolve(process.cwd(), "lib/sizing/agent-client.ts");
    const source = fs.readFileSync(srcPath, "utf-8");

    // agentFetch should use method: "POST"
    const fetchMatch = source.match(
      /async function agentFetch[\s\S]*?^}/m,
    );
    expect(fetchMatch).not.toBeNull();
    const fetchBody = fetchMatch![0];

    expect(fetchBody).toContain('method: "POST"');
    expect(fetchBody).toContain('"Content-Type": "application/json"');
    expect(fetchBody).toContain("Authorization");
  });

  /**
   * **Validates: Requirements 3.8**
   * When autofill is disabled or no tiers are missing, handleGenerate skips autofill.
   * We verify this by checking the ReportTab source code structure.
   */
  it("ReportTab skips autofill when disabled or no missing tiers", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const srcPath = path.resolve(process.cwd(), "components/sizing/ReportTab.tsx");
    const source = fs.readFileSync(srcPath, "utf-8");

    // handleGenerate checks: !skipAutofill && autofillEnabled && hasMissingTiers
    expect(source).toContain("skipAutofill");
    expect(source).toContain("autofillEnabled");
    expect(source).toContain("hasMissingTiers");

    // When conditions not met, it goes straight to generateExcelReport
    expect(source).toContain("generateExcelReport");
  });

  /**
   * **Validates: Requirements 3.9**
   * Autofill error handling shows warning banner with "Generate without auto-fill" fallback.
   */
  it("ReportTab shows 'Generate without auto-fill' fallback on error", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const srcPath = path.resolve(process.cwd(), "components/sizing/ReportTab.tsx");
    const source = fs.readFileSync(srcPath, "utf-8");

    // autofillFailed state triggers the fallback button
    expect(source).toContain("autofillFailed");
    expect(source).toContain("Generate without auto-fill");

    // The fallback button calls handleGenerate(true) to skip autofill
    expect(source).toMatch(/handleGenerate\(true\)/);
  });

  /**
   * **Validates: Requirements 3.11**
   * Partial failure merge logic reports unmatched services correctly.
   */
  it("mergePricingData preserves original data for unmatched services", () => {
    const svc1 = makeSampleService({ monthly: 100, upfront: 0, first12MonthsTotal: 1200 });
    const svc2 = makeSampleService({
      serviceName: "Amazon RDS",
      monthly: 500,
      upfront: 0,
      first12MonthsTotal: 6000,
    });
    const data = makePricingData([svc1, svc2]);

    // Autofill only returns data for EC2, not RDS
    const autofillResponse: AutofillResponse = {
      services: [
        {
          service: "Amazon EC2",
          description: "m5.xlarge",
          region: "US East (N. Virginia)",
          ri1Year: { upfront: 500, monthly: 80 },
        },
      ],
    };

    const merged = mergePricingData(data, autofillResponse, ["ri1Year"]);

    // RI 1-Year tier: EC2 should be updated, RDS should keep original values
    const ri1Tier = merged.tiers.find((t) => t.tierName === "RI 1-Year")!;
    const ec2 = ri1Tier.groups[0].services[0];
    const rds = ri1Tier.groups[0].services[1];

    // EC2 was matched — updated
    expect(ec2.monthly).toBe(80);
    expect(ec2.upfront).toBe(500);

    // RDS was NOT matched — keeps original values
    expect(rds.monthly).toBe(500);
    expect(rds.upfront).toBe(0);
  });

  /**
   * **Validates: Requirements 3.11**
   * ReportTab detects unmatched services and shows partial failure warning.
   */
  it("ReportTab reports unmatched services in partial failure", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const srcPath = path.resolve(process.cwd(), "components/sizing/ReportTab.tsx");
    const source = fs.readFileSync(srcPath, "utf-8");

    // Checks for unfilled services and reports them
    expect(source).toContain("unfilled");
    expect(source).toContain("could not be matched");
  });

  /**
   * **Validates: Requirements 3.8, 3.10, 3.11**
   * PBT: for all non-bug-condition inputs, callAgentSync behavior and merge logic
   * are structurally unchanged.
   */
  it("PBT: mergePricingData preserves On-Demand tier data unchanged", () => {
    fc.assert(
      fc.property(arbPricingData(), (data) => {
        // Empty autofill response — no services matched
        const emptyResponse: AutofillResponse = { services: [] };
        const merged = mergePricingData(data, emptyResponse, ["ri1Year"]);

        // On-Demand tier should be completely unchanged
        const origOD = data.tiers.find((t) => t.tierName === "On-Demand")!;
        const mergedOD = merged.tiers.find((t) => t.tierName === "On-Demand")!;

        expect(mergedOD.grandTotalMonthly).toBe(origOD.grandTotalMonthly);
        expect(mergedOD.grandTotalUpfront).toBe(origOD.grandTotalUpfront);

        for (let g = 0; g < origOD.groups.length; g++) {
          for (let s = 0; s < origOD.groups[g].services.length; s++) {
            const origSvc = origOD.groups[g].services[s];
            const mergedSvc = mergedOD.groups[g].services[s];
            expect(mergedSvc.monthly).toBe(origSvc.monthly);
            expect(mergedSvc.upfront).toBe(origSvc.upfront);
            expect(mergedSvc.serviceName).toBe(origSvc.serviceName);
          }
        }
      }),
      { numRuns: 30 },
    );
  });

  /**
   * **Validates: Requirements 3.11**
   * PBT: mergePricingData with no matching services preserves all tier data.
   */
  it("PBT: mergePricingData with no matches preserves all original values", () => {
    fc.assert(
      fc.property(arbPricingData(), (data) => {
        const noMatchResponse: AutofillResponse = {
          services: [
            {
              service: "NonExistentService_XYZ",
              description: "Does not exist",
              region: "nowhere",
              ri1Year: { upfront: 999, monthly: 999 },
            },
          ],
        };
        const merged = mergePricingData(data, noMatchResponse, ["ri1Year"]);

        // RI 1-Year tier services should keep original values (no match found)
        const origRI1 = data.tiers.find((t) => t.tierName === "RI 1-Year")!;
        const mergedRI1 = merged.tiers.find((t) => t.tierName === "RI 1-Year")!;

        for (let g = 0; g < origRI1.groups.length; g++) {
          for (let s = 0; s < origRI1.groups[g].services.length; s++) {
            const origSvc = origRI1.groups[g].services[s];
            const mergedSvc = mergedRI1.groups[g].services[s];
            expect(mergedSvc.monthly).toBe(origSvc.monthly);
            expect(mergedSvc.upfront).toBe(origSvc.upfront);
          }
        }
      }),
      { numRuns: 30 },
    );
  });
});
