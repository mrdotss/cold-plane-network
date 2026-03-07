import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { generateExcelReport, generateFullAnalysisReport } from "@/lib/sizing/excel-generator";
import type { PricingData, PricingGroup, PricingService, PricingTier } from "@/lib/sizing/types";

// --- Generators ---

const TIER_NAMES: PricingTier["tierName"][] = ["On-Demand", "RI 1-Year", "RI 3-Year"];

const COLUMN_HEADERS = [
  "Group Hierarchy",
  "Region",
  "Description",
  "Service",
  "Specification",
  "OD Upfront",
  "OD Monthly",
  "OD 12 Months",
  "RI 1Y Upfront",
  "RI 1Y Monthly",
  "RI 1Y 12 Months",
  "RI 3Y Upfront",
  "RI 3Y Monthly",
  "RI 3Y 12 Months",
  "Currency",
  "Configuration Summary",
];

function buildService(): fc.Arbitrary<PricingService> {
  return fc.record({
    groupHierarchy: fc.string({ minLength: 1, maxLength: 20 }),
    region: fc.string({ minLength: 1, maxLength: 15 }),
    description: fc.string({ maxLength: 30 }),
    serviceName: fc.string({ minLength: 1, maxLength: 20 }),
    specification: fc.string({ maxLength: 30 }),
    upfront: fc.float({ min: 0, max: 10000, noNaN: true }),
    monthly: fc.float({ min: 0, max: 10000, noNaN: true }),
    first12MonthsTotal: fc.float({ min: 0, max: 100000, noNaN: true }),
    currency: fc.constant("USD"),
    configurationSummary: fc.string({ maxLength: 30 }),
  });
}

function buildGroup(): fc.Arbitrary<PricingGroup> {
  return fc.array(buildService(), { minLength: 1, maxLength: 3 }).map((services) => {
    const name = services[0].groupHierarchy;
    const aligned = services.map((s) => ({ ...s, groupHierarchy: name }));
    return {
      name,
      services: aligned,
      subtotalUpfront: aligned.reduce((s, v) => s + v.upfront, 0),
      subtotalMonthly: aligned.reduce((s, v) => s + v.monthly, 0),
      subtotalFirst12Months: aligned.reduce((s, v) => s + v.first12MonthsTotal, 0),
    };
  });
}

function buildPricingData(): fc.Arbitrary<PricingData> {
  return fc.array(buildGroup(), { minLength: 1, maxLength: 3 }).map((groups) => {
    const tiers: PricingTier[] = TIER_NAMES.map((tierName) => ({
      tierName,
      groups,
      grandTotalUpfront: groups.reduce((s, g) => s + g.subtotalUpfront, 0),
      grandTotalMonthly: groups.reduce((s, g) => s + g.subtotalMonthly, 0),
      grandTotalFirst12Months: groups.reduce((s, g) => s + g.subtotalFirst12Months, 0),
    }));
    const regions = [...new Set(groups.flatMap((g) => g.services.map((s) => s.region)))].sort();
    const totalMonthly = tiers[0].grandTotalMonthly;
    return {
      fileName: "test.json",
      serviceCount: groups.reduce((s, g) => s + g.services.length, 0),
      regionCount: regions.length,
      regions,
      tiers,
      totalMonthly,
      totalAnnual: totalMonthly * 12,
      currency: "USD",
    };
  });
}

describe("Property 3: Excel report structure correctness", () => {
  /**
   * **Validates: Requirements 2.1, 2.2, 2.8**
   * For any valid PricingData with at least one service, the generated Excel workbook
   * SHALL contain a single sheet with a unified table layout containing all 15 column
   * headers (4 base + 3 tiers × 3 pricing cols + currency + config).
   */
  it("workbook has single sheet with unified column headers", async () => {
    await fc.assert(
      fc.asyncProperty(buildPricingData(), async (data) => {
        const workbook = await generateExcelReport(data);

        // Single sheet
        expect(workbook.worksheets.length).toBe(1);
        const sheet = workbook.worksheets[0];

        // Find the header row containing all column headers
        let headerRowFound = false;
        sheet.eachRow((row) => {
          const val = row.getCell(1).value;
          if (val === "Group Hierarchy") {
            headerRowFound = true;
            for (let col = 1; col <= COLUMN_HEADERS.length; col++) {
              expect(row.getCell(col).value).toBe(COLUMN_HEADERS[col - 1]);
            }
          }
        });
        expect(headerRowFound).toBe(true);
      }),
      { numRuns: 100 }
    );
  });
});

describe("Property 4: Excel totals correctness", () => {
  /**
   * **Validates: Requirements 2.3, 2.4**
   * For any valid PricingData, the Grand Total row SHALL contain the correct
   * sum of all group subtotals for the On-Demand tier monthly column.
   */
  it("grand total monthly is arithmetically correct for On-Demand", async () => {
    await fc.assert(
      fc.asyncProperty(buildPricingData(), async (data) => {
        const workbook = await generateExcelReport(data);
        const sheet = workbook.worksheets[0];

        // Find the Grand Total row
        let grandTotalRow: import("exceljs").Row | undefined;
        sheet.eachRow((row) => {
          const val = row.getCell(1).value;
          if (val === "Grand Total") {
            grandTotalRow = row;
          }
        });
        expect(grandTotalRow).toBeDefined();

        // OD Monthly is column 7 (shifted by Specification column at 5)
        const grandMonthly = Number(grandTotalRow!.getCell(7).value) || 0;
        const odTier = data.tiers.find((t) => t.tierName === "On-Demand") ?? data.tiers[0];
        expect(grandMonthly).toBeCloseTo(odTier.grandTotalMonthly, 2);
      }),
      { numRuns: 100 }
    );
  });
});

describe("Property 5: Full analysis Excel includes agent notes", () => {
  /**
   * **Validates: Requirements 4.1, 4.2**
   * For any valid PricingData and any non-empty agent notes string, the workbook
   * produced by generateFullAnalysisReport() SHALL contain the agent notes text
   * in an "AI Recommendations" section positioned after the pricing tables.
   */
  it("agent notes appear in workbook after pricing tables", async () => {
    await fc.assert(
      fc.asyncProperty(
        buildPricingData(),
        fc.string({ minLength: 1, maxLength: 200 }),
        async (data, notes) => {
          const workbook = await generateFullAnalysisReport(data, notes);
          const sheet = workbook.worksheets[0];

          // Find the AI Recommendations section header
          let notesHeaderRow = -1;
          let notesContentRow = -1;
          sheet.eachRow((row, rowNumber) => {
            const val = row.getCell(1).value;
            if (val === "AI Recommendations") {
              notesHeaderRow = rowNumber;
            }
            if (typeof val === "string" && val === notes) {
              notesContentRow = rowNumber;
            }
          });

          expect(notesHeaderRow).toBeGreaterThan(0);
          expect(notesContentRow).toBeGreaterThan(notesHeaderRow);
        }
      ),
      { numRuns: 100 }
    );
  });
});
