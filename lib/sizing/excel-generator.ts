import ExcelJS from "exceljs";
import type { PricingData } from "./types";
import { isRiEligible } from "@/lib/sizing/merge";

/**
 * Unified column layout:
 * Group | Region | Description | Service | Specification |
 * OD Upfront | OD Monthly | OD 12Mo |
 * RI1 Upfront | RI1 Monthly | RI1 12Mo |
 * RI3 Upfront | RI3 Monthly | RI3 12Mo |
 * Currency | Config Summary
 */
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

const COL_COUNT = COLUMN_HEADERS.length;

/** Currency columns (1-indexed): OD Upfront(6), OD Monthly(7), OD 12Mo(8),
 *  RI1 Upfront(9), RI1 Monthly(10), RI1 12Mo(11),
 *  RI3 Upfront(12), RI3 Monthly(13), RI3 12Mo(14) */
const CURRENCY_COLS = [6, 7, 8, 9, 10, 11, 12, 13, 14];
const CURRENCY_FMT = '#,##0.00';

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF4472C4" },
};

const SECTION_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFD9E2F3" },
};

const TOTAL_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFE2EFDA" },
};

const ALT_ROW_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFF2F2F2" },
};

const GREEN_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFC6EFCE" },
};

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin" },
  left: { style: "thin" },
  bottom: { style: "thin" },
  right: { style: "thin" },
};

const THICK_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "medium" },
  left: { style: "medium" },
  bottom: { style: "medium" },
  right: { style: "medium" },
};

/** Build a lookup: tierName → groupName → serviceIndex → PricingService */
function buildTierLookup(data: PricingData) {
  const lookup = new Map<string, Map<string, Map<number, {
    upfront: number; monthly: number; first12: number;
  }>>>();

  for (const tier of data.tiers) {
    const groupMap = new Map<string, Map<number, {
      upfront: number; monthly: number; first12: number;
    }>>();
    for (const group of tier.groups) {
      const svcMap = new Map<number, {
        upfront: number; monthly: number; first12: number;
      }>();
      group.services.forEach((svc, idx) => {
        svcMap.set(idx, {
          upfront: svc.upfront,
          monthly: svc.monthly,
          first12: svc.first12MonthsTotal,
        });
      });
      groupMap.set(group.name, svcMap);
    }
    lookup.set(tier.tierName, groupMap);
  }
  return lookup;
}

/** Apply currency format to specific columns in a row */
function applyCurrencyFormat(row: ExcelJS.Row) {
  for (const col of CURRENCY_COLS) {
    row.getCell(col).numFmt = CURRENCY_FMT;
  }
}

/** Apply thin borders to all cells in a row */
function applyThinBorders(row: ExcelJS.Row) {
  for (let col = 1; col <= COL_COUNT; col++) {
    row.getCell(col).border = THIN_BORDER;
  }
}

/** Apply thick borders to all cells in a row */
function applyThickBorders(row: ExcelJS.Row) {
  for (let col = 1; col <= COL_COUNT; col++) {
    row.getCell(col).border = THICK_BORDER;
  }
}

/** Auto-size column widths based on content */
function autoSizeColumns(sheet: ExcelJS.Worksheet) {
  for (let col = 1; col <= COL_COUNT; col++) {
    let maxLen = COLUMN_HEADERS[col - 1].length;
    sheet.eachRow((row) => {
      const cell = row.getCell(col);
      const val = cell.value;
      if (val != null) {
        const len = String(val).length;
        if (len > maxLen) maxLen = len;
      }
    });
    sheet.getColumn(col).width = Math.min(maxLen + 4, 50);
  }
}

/**
 * Generate an Excel workbook with a single unified table.
 * All tiers (On-Demand, RI 1-Year, RI 3-Year) appear as columns per service row.
 */
export async function generateExcelReport(data: PricingData): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Pricing Comparison");

  // Column widths (initial — will be auto-sized later)
  sheet.columns = COLUMN_HEADERS.map((h) => ({
    width: h.length < 12 ? 14 : h.length + 4,
  }));

  const tierLookup = buildTierLookup(data);
  const ri1Tier = tierLookup.get("RI 1-Year");
  const ri3Tier = tierLookup.get("RI 3-Year");

  // ── 8.1: Summary header section ──
  const summaryLabelStyle: Partial<ExcelJS.Style> = { font: { bold: true } };

  const titleRow = sheet.addRow(["Pricing Comparison Report"]);
  titleRow.font = { bold: true, size: 14 };
  sheet.mergeCells(titleRow.number, 1, titleRow.number, COL_COUNT);

  const fileRow = sheet.addRow(["File Name:", data.fileName]);
  fileRow.getCell(1).font = summaryLabelStyle.font!;

  const dateRow = sheet.addRow(["Generation Date:", new Date().toISOString().split("T")[0]]);
  dateRow.getCell(1).font = summaryLabelStyle.font!;

  const countRow = sheet.addRow(["Service Count:", data.serviceCount]);
  countRow.getCell(1).font = summaryLabelStyle.font!;

  const regionsRow = sheet.addRow(["Regions:", data.regions.join(", ")]);
  regionsRow.getCell(1).font = summaryLabelStyle.font!;

  const currencyRow = sheet.addRow(["Currency:", data.currency]);
  currencyRow.getCell(1).font = summaryLabelStyle.font!;

  // Per-tier monthly/annual totals
  for (const tier of data.tiers) {
    const tierSummaryRow = sheet.addRow([
      `${tier.tierName} Monthly:`, tier.grandTotalMonthly,
      `${tier.tierName} Annual:`, tier.grandTotalFirst12Months,
    ]);
    tierSummaryRow.getCell(1).font = summaryLabelStyle.font!;
    tierSummaryRow.getCell(2).numFmt = CURRENCY_FMT;
    tierSummaryRow.getCell(3).font = summaryLabelStyle.font!;
    tierSummaryRow.getCell(4).numFmt = CURRENCY_FMT;
  }

  // Blank separator
  sheet.addRow([]);

  // ── Tier group header row ──
  const tierGroupRow = sheet.addRow([
    "", "", "", "", "",
    "On-Demand", "", "",
    "RI 1-Year", "", "",
    "RI 3-Year", "", "",
    "", "",
  ]);
  tierGroupRow.font = { bold: true };
  tierGroupRow.alignment = { horizontal: "center" };
  sheet.mergeCells(tierGroupRow.number, 6, tierGroupRow.number, 8);
  sheet.mergeCells(tierGroupRow.number, 9, tierGroupRow.number, 11);
  sheet.mergeCells(tierGroupRow.number, 12, tierGroupRow.number, 14);
  tierGroupRow.eachCell((cell, colNumber) => {
    if (colNumber >= 6 && colNumber <= 14) {
      cell.fill = SECTION_FILL;
    }
  });

  // ── Column headers ──
  const headerRow = sheet.addRow(COLUMN_HEADERS);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.eachCell((cell) => {
    cell.fill = HEADER_FILL;
  });

  // ── 8.2: Freeze header rows (everything above data) ──
  sheet.views = [{ state: "frozen", ySplit: headerRow.number, xSplit: 0 }];

  // ── 8.2: Auto-filter on column headers ──
  sheet.autoFilter = {
    from: { row: headerRow.number, column: 1 },
    to: { row: headerRow.number, column: COL_COUNT },
  };

  // ── Data rows ──
  const baseTier = data.tiers.find((t) => t.tierName === "On-Demand") ?? data.tiers[0];
  if (!baseTier) return workbook;

  let grandOdUpfront = 0, grandOdMonthly = 0, grandOd12 = 0;
  let grandRi1Upfront = 0, grandRi1Monthly = 0, grandRi112 = 0;
  let grandRi3Upfront = 0, grandRi3Monthly = 0, grandRi312 = 0;
  let dataRowIndex = 0;

  for (const group of baseTier.groups) {
    let grpOdUp = 0, grpOdMo = 0, grpOd12 = 0;
    let grpRi1Up = 0, grpRi1Mo = 0, grpRi112 = 0;
    let grpRi3Up = 0, grpRi3Mo = 0, grpRi312 = 0;

    group.services.forEach((svc, idx) => {
      const ri1 = ri1Tier?.get(group.name)?.get(idx);
      const ri3 = ri3Tier?.get(group.name)?.get(idx);

      const ri1Up = ri1?.upfront ?? 0;
      const ri1Mo = ri1?.monthly ?? 0;
      const ri1F12 = ri1?.first12 ?? 0;
      const ri3Up = ri3?.upfront ?? 0;
      const ri3Mo = ri3?.monthly ?? 0;
      const ri3F12 = ri3?.first12 ?? 0;

      const row = sheet.addRow([
        svc.groupHierarchy,
        svc.region,
        svc.description,
        svc.serviceName,
        svc.specification,
        svc.upfront,
        svc.monthly,
        svc.first12MonthsTotal,
        ri1Up,
        ri1Mo,
        ri1F12,
        ri3Up,
        ri3Mo,
        ri3F12,
        svc.currency,
        svc.configurationSummary,
      ]);

      // 8.3: Currency formatting
      applyCurrencyFormat(row);

      // 8.2: Thin borders on data cells
      applyThinBorders(row);

      // 8.2: Alternating row colors
      if (dataRowIndex % 2 === 1) {
        for (let col = 1; col <= COL_COUNT; col++) {
          row.getCell(col).fill = ALT_ROW_FILL;
        }
      }

      // 8.4: Conditional formatting — RI savings > 30% (RI monthly < 70% of OD monthly)
      const odMonthly = svc.monthly;
      if (odMonthly > 0) {
        // RI 1Y Monthly (col 10)
        if (ri1Mo < odMonthly * 0.7) {
          row.getCell(10).fill = GREEN_FILL;
        }
        // RI 3Y Monthly (col 13)
        if (ri3Mo < odMonthly * 0.7) {
          row.getCell(13).fill = GREEN_FILL;
        }
      }

      dataRowIndex++;

      grpOdUp += svc.upfront;
      grpOdMo += svc.monthly;
      grpOd12 += svc.first12MonthsTotal;
      grpRi1Up += ri1Up;
      grpRi1Mo += ri1Mo;
      grpRi112 += ri1F12;
      grpRi3Up += ri3Up;
      grpRi3Mo += ri3Mo;
      grpRi312 += ri3F12;
    });

    // Group subtotal
    const subRow = sheet.addRow([
      `${group.name} Subtotal`, "", "", "", "",
      grpOdUp, grpOdMo, grpOd12,
      grpRi1Up, grpRi1Mo, grpRi112,
      grpRi3Up, grpRi3Mo, grpRi312,
      "", "",
    ]);
    subRow.font = { bold: true };
    applyCurrencyFormat(subRow);
    applyThickBorders(subRow);

    grandOdUpfront += grpOdUp;
    grandOdMonthly += grpOdMo;
    grandOd12 += grpOd12;
    grandRi1Upfront += grpRi1Up;
    grandRi1Monthly += grpRi1Mo;
    grandRi112 += grpRi112;
    grandRi3Upfront += grpRi3Up;
    grandRi3Monthly += grpRi3Mo;
    grandRi312 += grpRi312;
  }

  // Grand total
  const grandRow = sheet.addRow([
    "Grand Total", "", "", "", "",
    grandOdUpfront, grandOdMonthly, grandOd12,
    grandRi1Upfront, grandRi1Monthly, grandRi112,
    grandRi3Upfront, grandRi3Monthly, grandRi312,
    "", "",
  ]);
  grandRow.font = { bold: true };
  grandRow.fill = TOTAL_FILL;
  applyCurrencyFormat(grandRow);
  applyThickBorders(grandRow);

  // ── 8.5: RI-ineligible footnote ──
  const allServices = baseTier.groups.flatMap((g) => g.services);
  const riIneligible = [...new Set(
    allServices
      .filter((s) => !isRiEligible(s.serviceName))
      .map((s) => s.serviceName)
  )];

  if (riIneligible.length > 0) {
    sheet.addRow([]);
    const footnoteHeader = sheet.addRow(["RI-Ineligible Services"]);
    footnoteHeader.font = { bold: true, size: 11 };
    sheet.mergeCells(footnoteHeader.number, 1, footnoteHeader.number, COL_COUNT);

    const footnoteRow = sheet.addRow([
      `The following services do not support Reserved Instance pricing: ${riIneligible.join(", ")}`,
    ]);
    sheet.mergeCells(footnoteRow.number, 1, footnoteRow.number, COL_COUNT);
    footnoteRow.getCell(1).alignment = { wrapText: true };
  }

  // 8.3: Auto-size column widths
  autoSizeColumns(sheet);

  return workbook;
}

/**
 * Generate an Excel workbook with agent notes appended (V3).
 */
export async function generateFullAnalysisReport(
  data: PricingData,
  agentNotes: string
): Promise<ExcelJS.Workbook> {
  const workbook = await generateExcelReport(data);
  const sheet = workbook.getWorksheet("Pricing Comparison")!;

  // Blank separator
  sheet.addRow([]);

  // Notes section header
  const notesHeader = sheet.addRow(["AI Recommendations"]);
  notesHeader.font = { bold: true, size: 13 };
  notesHeader.fill = SECTION_FILL;
  sheet.mergeCells(notesHeader.number, 1, notesHeader.number, COL_COUNT);

  // Notes content
  const notesRow = sheet.addRow([agentNotes]);
  sheet.mergeCells(notesRow.number, 1, notesRow.number, COL_COUNT);
  notesRow.getCell(1).alignment = { wrapText: true, vertical: "top" };

  return workbook;
}

/**
 * Trigger browser download of an ExcelJS workbook.
 */
export async function downloadWorkbook(workbook: ExcelJS.Workbook, fileName: string): Promise<void> {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName.endsWith(".xlsx") ? fileName : `${fileName}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
