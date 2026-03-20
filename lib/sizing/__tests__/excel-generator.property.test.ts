import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { generateExcelReport, generateFullAnalysisReport } from "@/lib/sizing/excel-generator";
import type { PricingData, PricingGroup, PricingService, PricingTier } from "@/lib/sizing/types";
import { isRiEligible } from "@/lib/sizing/merge";

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
    properties: fc.dictionary(
      fc.string({ minLength: 1, maxLength: 10 }),
      fc.string({ maxLength: 20 }),
      { minKeys: 0, maxKeys: 3 }
    ),
  });
}

/** RI-ineligible service names for targeted generators */
const RI_INELIGIBLE_NAMES = [
  "Amazon S3",
  "AWS VPN Connection",
  "Amazon Route 53",
  "Amazon CloudWatch",
  "AWS Lambda",
  "Amazon CloudFront",
  "Amazon SNS",
  "Amazon SQS",
];

/** Build a service with a known RI-ineligible name */
function buildRiIneligibleService(): fc.Arbitrary<PricingService> {
  return fc.record({
    groupHierarchy: fc.string({ minLength: 1, maxLength: 20 }),
    region: fc.string({ minLength: 1, maxLength: 15 }),
    description: fc.string({ maxLength: 30 }),
    serviceName: fc.constantFrom(...RI_INELIGIBLE_NAMES),
    specification: fc.string({ maxLength: 30 }),
    upfront: fc.float({ min: 0, max: 10000, noNaN: true }),
    monthly: fc.float({ min: 0, max: 10000, noNaN: true }),
    first12MonthsTotal: fc.float({ min: 0, max: 100000, noNaN: true }),
    currency: fc.constant("USD"),
    configurationSummary: fc.string({ maxLength: 30 }),
    properties: fc.dictionary(
      fc.string({ minLength: 1, maxLength: 10 }),
      fc.string({ maxLength: 20 }),
      { minKeys: 0, maxKeys: 3 }
    ),
  });
}

/**
 * Build PricingData with distinct per-tier pricing so RI savings can be tested.
 * OD monthly is always > 0, RI tiers get a fraction of OD pricing.
 */
function buildPricingDataWithRiSavings(): fc.Arbitrary<PricingData> {
  return fc
    .tuple(
      fc.array(
        fc.tuple(
          fc.string({ minLength: 1, maxLength: 15 }), // group name
          fc.array(
            fc.tuple(
              buildService(),
              fc.float({ min: 100, max: 10000, noNaN: true }), // OD monthly (always > 0)
              fc.float({ min: Math.fround(0.1), max: 1.0, noNaN: true }),   // RI1 fraction of OD
              fc.float({ min: Math.fround(0.1), max: 1.0, noNaN: true }),   // RI3 fraction of OD
            ),
            { minLength: 1, maxLength: 3 }
          )
        ),
        { minLength: 1, maxLength: 3 }
      ),
      fc.string({ minLength: 1, maxLength: 20 }) // fileName
    )
    .map(([groupDefs, fileName]) => {
      const groups: PricingGroup[] = groupDefs.map(([gName, svcDefs]) => {
        const services: PricingService[] = svcDefs.map(([svc]) => ({
          ...svc,
          groupHierarchy: gName,
        }));
        return {
          name: gName,
          services,
          subtotalUpfront: services.reduce((s, v) => s + v.upfront, 0),
          subtotalMonthly: services.reduce((s, v) => s + v.monthly, 0),
          subtotalFirst12Months: services.reduce((s, v) => s + v.first12MonthsTotal, 0),
        };
      });

      // Build 3 tiers with distinct pricing
      const tiers: PricingTier[] = [];
      for (const tierName of TIER_NAMES) {
        const tierGroups: PricingGroup[] = groupDefs.map(([gName, svcDefs]) => {
          const services: PricingService[] = svcDefs.map(([svc, odMo, ri1Frac, ri3Frac]) => {
            let monthly: number;
            if (tierName === "On-Demand") monthly = odMo;
            else if (tierName === "RI 1-Year") monthly = odMo * ri1Frac;
            else monthly = odMo * ri3Frac;
            return {
              ...svc,
              groupHierarchy: gName,
              monthly,
              upfront: tierName === "On-Demand" ? 0 : svc.upfront,
              first12MonthsTotal: monthly * 12 + (tierName === "On-Demand" ? 0 : svc.upfront),
            };
          });
          return {
            name: gName,
            services,
            subtotalUpfront: services.reduce((s, v) => s + v.upfront, 0),
            subtotalMonthly: services.reduce((s, v) => s + v.monthly, 0),
            subtotalFirst12Months: services.reduce((s, v) => s + v.first12MonthsTotal, 0),
          };
        });
        tiers.push({
          tierName,
          groups: tierGroups,
          grandTotalUpfront: tierGroups.reduce((s, g) => s + g.subtotalUpfront, 0),
          grandTotalMonthly: tierGroups.reduce((s, g) => s + g.subtotalMonthly, 0),
          grandTotalFirst12Months: tierGroups.reduce((s, g) => s + g.subtotalFirst12Months, 0),
        });
      }

      const regions = [...new Set(groups.flatMap((g) => g.services.map((s) => s.region)))].sort();
      return {
        fileName,
        serviceCount: groups.reduce((s, g) => s + g.services.length, 0),
        regionCount: regions.length,
        regions,
        tiers,
        totalMonthly: tiers[0].grandTotalMonthly,
        totalAnnual: tiers[0].grandTotalMonthly * 12,
        currency: "USD",
      };
    });
}

/**
 * Build PricingData that includes at least one RI-ineligible service.
 */
function buildPricingDataWithRiIneligible(): fc.Arbitrary<PricingData> {
  return fc
    .tuple(
      buildRiIneligibleService(),
      fc.array(buildService(), { minLength: 0, maxLength: 2 })
    )
    .map(([ineligibleSvc, otherSvcs]) => {
      const allSvcs = [ineligibleSvc, ...otherSvcs];
      const gName = ineligibleSvc.groupHierarchy;
      const aligned = allSvcs.map((s) => ({ ...s, groupHierarchy: gName }));
      const group: PricingGroup = {
        name: gName,
        services: aligned,
        subtotalUpfront: aligned.reduce((s, v) => s + v.upfront, 0),
        subtotalMonthly: aligned.reduce((s, v) => s + v.monthly, 0),
        subtotalFirst12Months: aligned.reduce((s, v) => s + v.first12MonthsTotal, 0),
      };
      const tiers: PricingTier[] = TIER_NAMES.map((tierName) => ({
        tierName,
        groups: [group],
        grandTotalUpfront: group.subtotalUpfront,
        grandTotalMonthly: group.subtotalMonthly,
        grandTotalFirst12Months: group.subtotalFirst12Months,
      }));
      const regions = [...new Set(aligned.map((s) => s.region))].sort();
      return {
        fileName: "test-ri-ineligible.json",
        serviceCount: aligned.length,
        regionCount: regions.length,
        regions,
        tiers,
        totalMonthly: tiers[0].grandTotalMonthly,
        totalAnnual: tiers[0].grandTotalMonthly * 12,
        currency: "USD",
      };
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


// Feature: sizing-v2-chatbot, Property 16: Excel workbook structural formatting
describe("Property 16: Excel workbook structural formatting", () => {
  /**
   * **Validates: Requirements 10.2, 10.3, 10.7, 10.8, 10.9**
   * For any valid PricingData, the generated Excel workbook should have:
   * (a) worksheet named "Pricing Comparison",
   * (b) frozen header rows,
   * (c) alternating row fill colors on data rows,
   * (d) thin borders on data cells and thick borders on total rows,
   * (e) auto-filter enabled on column headers.
   */
  it("worksheet has correct name, frozen rows, alternating colors, borders, and auto-filter", async () => {
    await fc.assert(
      fc.asyncProperty(buildPricingData(), async (data) => {
        const workbook = await generateExcelReport(data);

        // (a) Worksheet named "Pricing Comparison"
        const sheet = workbook.getWorksheet("Pricing Comparison");
        expect(sheet).toBeDefined();
        expect(sheet!.name).toBe("Pricing Comparison");

        // (b) Frozen header rows
        expect(sheet!.views.length).toBeGreaterThan(0);
        const view = sheet!.views[0] as Record<string, unknown>;
        expect(view.state).toBe("frozen");
        expect(view.ySplit).toBeGreaterThan(0);

        // Find the column header row and data rows
        let headerRowNum = -1;
        sheet!.eachRow((row, rowNumber) => {
          if (row.getCell(1).value === "Group Hierarchy") {
            headerRowNum = rowNumber;
          }
        });
        expect(headerRowNum).toBeGreaterThan(0);

        // (c) Alternating row fill colors on data rows
        // Collect data rows (between header and first subtotal/grand total)
        const dataRows: { rowNumber: number; row: import("exceljs").Row }[] = [];
        sheet!.eachRow((row, rowNumber) => {
          if (rowNumber <= headerRowNum) return;
          const val = String(row.getCell(1).value ?? "");
          if (val === "Grand Total" || val.endsWith("Subtotal")) return;
          if (val === "" && row.getCell(2).value == null) return; // blank/separator
          if (val === "RI-Ineligible Services") return;
          if (val.startsWith("The following services")) return;
          dataRows.push({ rowNumber, row });
        });

        // Check alternating: even-indexed data rows (0-based) = white (no fill or default),
        // odd-indexed = light gray #F2F2F2
        for (let i = 0; i < dataRows.length; i++) {
          const cell = dataRows[i].row.getCell(1);
          const fill = cell.fill as { fgColor?: { argb?: string } } | undefined;
          if (i % 2 === 1) {
            // Odd data rows should have gray fill
            expect(fill?.fgColor?.argb).toBe("FFF2F2F2");
          }
          // Even rows: no fill or default (we don't enforce white explicitly)
        }

        // (d) Thin borders on data cells, thick borders on total rows
        for (const { row } of dataRows) {
          const border = row.getCell(1).border;
          expect(border?.top?.style).toBe("thin");
        }

        // Check subtotal/grand total rows have thick (medium) borders
        sheet!.eachRow((row) => {
          const val = String(row.getCell(1).value ?? "");
          if (val === "Grand Total" || val.endsWith("Subtotal")) {
            const border = row.getCell(1).border;
            expect(border?.top?.style).toBe("medium");
          }
        });

        // (e) Auto-filter enabled on column headers
        expect(sheet!.autoFilter).toBeDefined();
      }),
      { numRuns: 100 }
    );
  });
});

// Feature: sizing-v2-chatbot, Property 17: Excel currency formatting and conditional RI savings highlighting
describe("Property 17: Excel currency formatting and conditional RI savings highlighting", () => {
  /**
   * **Validates: Requirements 10.4, 10.6**
   * For any valid PricingData, all currency cells use numFmt with 2 decimal places
   * and thousands separators. For any service where RI monthly < 70% of OD monthly,
   * the RI cell should have green fill.
   */
  it("currency cells have numFmt and RI savings cells have green fill", async () => {
    await fc.assert(
      fc.asyncProperty(buildPricingDataWithRiSavings(), async (data) => {
        const workbook = await generateExcelReport(data);
        const sheet = workbook.getWorksheet("Pricing Comparison")!;

        // Find header row
        let headerRowNum = -1;
        sheet.eachRow((row, rowNumber) => {
          if (row.getCell(1).value === "Group Hierarchy") {
            headerRowNum = rowNumber;
          }
        });

        // Collect data rows
        const dataRows: import("exceljs").Row[] = [];
        sheet.eachRow((row, rowNumber) => {
          if (rowNumber <= headerRowNum) return;
          const val = String(row.getCell(1).value ?? "");
          if (val === "Grand Total" || val.endsWith("Subtotal")) return;
          if (val === "" && row.getCell(2).value == null) return;
          if (val === "RI-Ineligible Services") return;
          if (val.startsWith("The following services")) return;
          dataRows.push(row);
        });

        // Currency columns: 6-14
        const currencyCols = [6, 7, 8, 9, 10, 11, 12, 13, 14];
        for (const row of dataRows) {
          for (const col of currencyCols) {
            expect(row.getCell(col).numFmt).toBe("#,##0.00");
          }
        }

        // RI savings conditional formatting
        // OD Monthly = col 7, RI 1Y Monthly = col 10, RI 3Y Monthly = col 13
        for (const row of dataRows) {
          const odMonthly = Number(row.getCell(7).value) || 0;
          if (odMonthly > 0) {
            const ri1Monthly = Number(row.getCell(10).value) || 0;
            const ri3Monthly = Number(row.getCell(13).value) || 0;

            if (ri1Monthly < odMonthly * 0.7) {
              const fill = row.getCell(10).fill as { fgColor?: { argb?: string } };
              expect(fill?.fgColor?.argb).toBe("FFC6EFCE");
            }
            if (ri3Monthly < odMonthly * 0.7) {
              const fill = row.getCell(13).fill as { fgColor?: { argb?: string } };
              expect(fill?.fgColor?.argb).toBe("FFC6EFCE");
            }
          }
        }
      }),
      { numRuns: 100 }
    );
  });
});

// Feature: sizing-v2-chatbot, Property 18: Excel summary header section
describe("Property 18: Excel summary header section", () => {
  /**
   * **Validates: Requirements 10.1**
   * For any valid PricingData, the workbook contains a summary section at the top
   * with file name, generation date, total service count, region list, and total
   * monthly/annual costs per tier.
   */
  it("summary header contains file name, date, service count, regions, and tier totals", async () => {
    await fc.assert(
      fc.asyncProperty(buildPricingData(), async (data) => {
        const workbook = await generateExcelReport(data);
        const sheet = workbook.getWorksheet("Pricing Comparison")!;

        // Collect all cell values from the top rows (before column headers)
        let headerRowNum = -1;
        sheet.eachRow((row, rowNumber) => {
          if (row.getCell(1).value === "Group Hierarchy") {
            headerRowNum = rowNumber;
          }
        });

        const summaryValues: string[] = [];
        sheet.eachRow((row, rowNumber) => {
          if (rowNumber >= headerRowNum) return;
          for (let col = 1; col <= 4; col++) {
            const val = row.getCell(col).value;
            if (val != null) summaryValues.push(String(val));
          }
        });

        const summaryText = summaryValues.join(" ");

        // File name
        expect(summaryText).toContain("File Name:");
        expect(summaryText).toContain(data.fileName);

        // Generation date (YYYY-MM-DD format)
        expect(summaryText).toContain("Generation Date:");
        expect(summaryText).toMatch(/\d{4}-\d{2}-\d{2}/);

        // Service count
        expect(summaryText).toContain("Service Count:");
        expect(summaryText).toContain(String(data.serviceCount));

        // Regions
        expect(summaryText).toContain("Regions:");
        for (const region of data.regions) {
          expect(summaryText).toContain(region);
        }

        // Per-tier totals
        for (const tier of data.tiers) {
          expect(summaryText).toContain(`${tier.tierName} Monthly:`);
          expect(summaryText).toContain(`${tier.tierName} Annual:`);
        }
      }),
      { numRuns: 100 }
    );
  });
});

// Feature: sizing-v2-chatbot, Property 19: RI-ineligible footnote in Excel
describe("Property 19: RI-ineligible footnote in Excel", () => {
  /**
   * **Validates: Requirements 10.10**
   * For any PricingData containing services matching RI-ineligible patterns,
   * the workbook includes a footnote section listing those service names.
   */
  it("footnote lists RI-ineligible service names", async () => {
    await fc.assert(
      fc.asyncProperty(buildPricingDataWithRiIneligible(), async (data) => {
        const workbook = await generateExcelReport(data);
        const sheet = workbook.getWorksheet("Pricing Comparison")!;

        // Identify RI-ineligible services from the data
        const baseTier = data.tiers.find((t) => t.tierName === "On-Demand") ?? data.tiers[0];
        const ineligibleNames = [
          ...new Set(
            baseTier.groups
              .flatMap((g) => g.services)
              .filter((s) => !isRiEligible(s.serviceName))
              .map((s) => s.serviceName)
          ),
        ];
        expect(ineligibleNames.length).toBeGreaterThan(0);

        // Find the footnote section
        let footnoteHeaderFound = false;
        let footnoteContent = "";
        sheet.eachRow((row) => {
          const val = String(row.getCell(1).value ?? "");
          if (val === "RI-Ineligible Services") {
            footnoteHeaderFound = true;
          }
          if (val.startsWith("The following services do not support")) {
            footnoteContent = val;
          }
        });

        expect(footnoteHeaderFound).toBe(true);
        expect(footnoteContent.length).toBeGreaterThan(0);

        // Each ineligible service name should appear in the footnote
        for (const name of ineligibleNames) {
          expect(footnoteContent).toContain(name);
        }
      }),
      { numRuns: 100 }
    );
  });
});
