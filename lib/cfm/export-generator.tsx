import "server-only";

import ExcelJS from "exceljs";
import type {
  CfmScan,
  CfmAccount,
  CfmRecommendation,
  CfmScanSummary,
  CfmServiceBreakdown,
} from "./types";

// ─── Shared Constants ────────────────────────────────────────────────────────

const CURRENCY_FMT = "$#,##0.00";

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF4472C4" },
};

const HEADER_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  color: { argb: "FFFFFFFF" },
  size: 11,
};

const CRITICAL_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFFCE4EC" },
};

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin" },
  left: { style: "thin" },
  bottom: { style: "thin" },
  right: { style: "thin" },
};

// ─── Excel Generation ────────────────────────────────────────────────────────

/**
 * Generate a CFM analysis Excel workbook with:
 * 1. Executive Summary sheet
 * 2. Per-service sheets (one per distinct service)
 * 3. Prioritized Action Plan sheet
 */
export async function generateExcel(
  scan: CfmScan,
  account: CfmAccount,
  recommendations: CfmRecommendation[],
): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Cold Plane Network";
  workbook.created = new Date();

  const summary = scan.summary;

  addExecutiveSummarySheet(workbook, scan, account, summary, recommendations);

  // Per-service sheets
  const serviceGroups = groupByService(recommendations);
  const serviceNames = [...serviceGroups.keys()].sort();
  for (const service of serviceNames) {
    const recs = serviceGroups.get(service)!;
    addServiceSheet(workbook, service, recs);
  }

  addActionPlanSheet(workbook, recommendations);

  return workbook;
}


// ─── Executive Summary Sheet ─────────────────────────────────────────────────

function addExecutiveSummarySheet(
  workbook: ExcelJS.Workbook,
  scan: CfmScan,
  account: CfmAccount,
  summary: CfmScanSummary | null,
  recommendations: CfmRecommendation[],
) {
  const ws = workbook.addWorksheet("Executive Summary");

  // Title
  ws.mergeCells("A1:F1");
  const titleCell = ws.getCell("A1");
  titleCell.value = "CFM Analysis Report — Executive Summary";
  titleCell.font = { bold: true, size: 16 };
  titleCell.alignment = { horizontal: "left" };

  // Account details
  ws.getCell("A3").value = "Account Name";
  ws.getCell("B3").value = account.accountName;
  ws.getCell("A4").value = "AWS Account ID";
  ws.getCell("B4").value = account.awsAccountId;
  ws.getCell("A5").value = "Regions";
  ws.getCell("B5").value = account.regions.join(", ");
  ws.getCell("A6").value = "Scan Date";
  ws.getCell("B6").value = scan.completedAt
    ? new Date(scan.completedAt).toISOString().split("T")[0]
    : "N/A";

  for (let r = 3; r <= 6; r++) {
    ws.getCell(`A${r}`).font = { bold: true };
  }

  // Financial summary
  const totalSpend = summary?.totalMonthlySpend ?? 0;
  const totalSavings = summary?.totalPotentialSavings ?? 0;
  const savingsPct = totalSpend > 0 ? (totalSavings / totalSpend) * 100 : 0;

  ws.getCell("A8").value = "Financial Overview";
  ws.getCell("A8").font = { bold: true, size: 13 };

  const finHeaders = ["Metric", "Value"];
  const finData = [
    ["Total Monthly Spend", totalSpend],
    ["Potential Monthly Savings", totalSavings],
    ["Savings Percentage", `${savingsPct.toFixed(1)}%`],
    ["Total Recommendations", summary?.recommendationCount ?? recommendations.length],
  ];

  const finStartRow = 9;
  applyHeaderRow(ws, finStartRow, finHeaders, 1);
  finData.forEach((row, i) => {
    const r = finStartRow + 1 + i;
    ws.getCell(r, 1).value = row[0];
    const valCell = ws.getCell(r, 2);
    valCell.value = row[1];
    if (typeof row[1] === "number") {
      valCell.numFmt = CURRENCY_FMT;
    }
    applyBorders(ws, r, 1, 2);
  });

  // Priority breakdown
  const prioStartRow = finStartRow + finData.length + 2;
  ws.getCell(`A${prioStartRow}`).value = "Priority Breakdown";
  ws.getCell(`A${prioStartRow}`).font = { bold: true, size: 13 };

  const prioHeaders = ["Priority", "Count"];
  const prioData = [
    ["Critical", summary?.priorityBreakdown.critical ?? 0],
    ["Medium", summary?.priorityBreakdown.medium ?? 0],
    ["Low", summary?.priorityBreakdown.low ?? 0],
  ];

  applyHeaderRow(ws, prioStartRow + 1, prioHeaders, 1);
  prioData.forEach((row, i) => {
    const r = prioStartRow + 2 + i;
    ws.getCell(r, 1).value = row[0];
    ws.getCell(r, 2).value = row[1];
    applyBorders(ws, r, 1, 2);
  });

  // Service breakdown
  const svcStartRow = prioStartRow + prioData.length + 3;
  ws.getCell(`A${svcStartRow}`).value = "Service Breakdown";
  ws.getCell(`A${svcStartRow}`).font = { bold: true, size: 13 };

  const svcHeaders = ["Service", "Current Spend", "Potential Savings", "Recommendations"];
  applyHeaderRow(ws, svcStartRow + 1, svcHeaders, 1);

  const breakdowns = summary?.serviceBreakdown ?? [];
  breakdowns.forEach((svc: CfmServiceBreakdown, i: number) => {
    const r = svcStartRow + 2 + i;
    ws.getCell(r, 1).value = svc.service;
    ws.getCell(r, 2).value = svc.currentSpend;
    ws.getCell(r, 2).numFmt = CURRENCY_FMT;
    ws.getCell(r, 3).value = svc.potentialSavings;
    ws.getCell(r, 3).numFmt = CURRENCY_FMT;
    ws.getCell(r, 4).value = svc.recommendationCount;
    applyBorders(ws, r, 1, 4);
  });

  autoFitColumns(ws);
}


// ─── Per-Service Sheet ───────────────────────────────────────────────────────

/** Column definitions per service for service-specific detail sheets. */
const SERVICE_COLUMNS: Record<string, { header: string; key: keyof CfmRecommendation | string; isCurrency?: boolean }[]> = {
  EC2: [
    { header: "Instance ID", key: "resourceId" },
    { header: "Current Type", key: "meta:currentType" },
    { header: "Recommended Type", key: "meta:recommendedType" },
    { header: "Avg CPU %", key: "meta:avgCpu" },
    { header: "Priority", key: "priority" },
    { header: "Monthly Savings", key: "estimatedSavings", isCurrency: true },
    { header: "Effort", key: "effort" },
  ],
  RDS: [
    { header: "DB Instance", key: "resourceId" },
    { header: "Status", key: "meta:status" },
    { header: "Recommendation", key: "recommendation" },
    { header: "Connections (30d)", key: "meta:connections" },
    { header: "Priority", key: "priority" },
    { header: "Monthly Savings", key: "estimatedSavings", isCurrency: true },
    { header: "Effort", key: "effort" },
  ],
  S3: [
    { header: "Bucket Name", key: "resourceId" },
    { header: "Current Class", key: "meta:currentClass" },
    { header: "Recommended Class", key: "meta:recommendedClass" },
    { header: "Access Pattern", key: "meta:accessPattern" },
    { header: "Priority", key: "priority" },
    { header: "Monthly Savings", key: "estimatedSavings", isCurrency: true },
    { header: "Effort", key: "effort" },
  ],
};

/** Default columns for services without a specific layout. */
const DEFAULT_COLUMNS = [
  { header: "Resource ID", key: "resourceId" },
  { header: "Resource Name", key: "resourceName" },
  { header: "Priority", key: "priority" },
  { header: "Recommendation", key: "recommendation" },
  { header: "Current Cost", key: "currentCost", isCurrency: true },
  { header: "Monthly Savings", key: "estimatedSavings", isCurrency: true },
  { header: "Effort", key: "effort" },
];

function getColumnValue(rec: CfmRecommendation, key: string): unknown {
  if (key.startsWith("meta:")) {
    const metaKey = key.slice(5);
    return rec.metadata?.[metaKey] ?? "";
  }
  return rec[key as keyof CfmRecommendation] ?? "";
}

function addServiceSheet(
  workbook: ExcelJS.Workbook,
  service: string,
  recs: CfmRecommendation[],
) {
  // Excel sheet names max 31 chars, no special chars
  const sheetName = service.slice(0, 31);
  const ws = workbook.addWorksheet(sheetName);

  const columns = SERVICE_COLUMNS[service] ?? DEFAULT_COLUMNS;
  const headers = columns.map((c) => c.header);

  applyHeaderRow(ws, 1, headers, 1);

  recs.forEach((rec, i) => {
    const r = i + 2;
    columns.forEach((col, ci) => {
      const cell = ws.getCell(r, ci + 1);
      const val = getColumnValue(rec, col.key);
      cell.value = val as ExcelJS.CellValue;
      if (col.isCurrency && typeof val === "number") {
        cell.numFmt = CURRENCY_FMT;
      }
    });
    applyBorders(ws, r, 1, columns.length);

    // Conditional formatting: red fill for critical rows
    if (rec.priority === "critical") {
      for (let ci = 1; ci <= columns.length; ci++) {
        ws.getCell(r, ci).fill = CRITICAL_FILL;
      }
    }
  });

  autoFitColumns(ws);
}


// ─── Prioritized Action Plan Sheet ───────────────────────────────────────────

function addActionPlanSheet(
  workbook: ExcelJS.Workbook,
  recommendations: CfmRecommendation[],
) {
  const ws = workbook.addWorksheet("Prioritized Action Plan");

  const headers = [
    "Priority",
    "Service",
    "Resource",
    "Recommendation",
    "Monthly Savings",
    "Effort",
  ];

  applyHeaderRow(ws, 1, headers, 1);

  const sorted = [...recommendations].sort(
    (a, b) => b.estimatedSavings - a.estimatedSavings,
  );

  sorted.forEach((rec, i) => {
    const r = i + 2;
    ws.getCell(r, 1).value = rec.priority;
    ws.getCell(r, 2).value = rec.service;
    ws.getCell(r, 3).value = rec.resourceName
      ? `${rec.resourceId} (${rec.resourceName})`
      : rec.resourceId;
    ws.getCell(r, 4).value = rec.recommendation;
    const savingsCell = ws.getCell(r, 5);
    savingsCell.value = rec.estimatedSavings;
    savingsCell.numFmt = CURRENCY_FMT;
    ws.getCell(r, 6).value = rec.effort;

    applyBorders(ws, r, 1, headers.length);

    if (rec.priority === "critical") {
      for (let ci = 1; ci <= headers.length; ci++) {
        ws.getCell(r, ci).fill = CRITICAL_FILL;
      }
    }
  });

  autoFitColumns(ws);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function groupByService(
  recommendations: CfmRecommendation[],
): Map<string, CfmRecommendation[]> {
  const map = new Map<string, CfmRecommendation[]>();
  for (const rec of recommendations) {
    const existing = map.get(rec.service);
    if (existing) {
      existing.push(rec);
    } else {
      map.set(rec.service, [rec]);
    }
  }
  return map;
}

function applyHeaderRow(
  ws: ExcelJS.Worksheet,
  row: number,
  headers: string[],
  startCol: number,
) {
  headers.forEach((h, i) => {
    const cell = ws.getCell(row, startCol + i);
    cell.value = h;
    cell.font = HEADER_FONT;
    cell.fill = HEADER_FILL;
    cell.border = THIN_BORDER;
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });
}

function applyBorders(
  ws: ExcelJS.Worksheet,
  row: number,
  startCol: number,
  endCol: number,
) {
  for (let c = startCol; c <= endCol; c++) {
    ws.getCell(row, c).border = THIN_BORDER;
  }
}

function autoFitColumns(ws: ExcelJS.Worksheet) {
  ws.columns.forEach((col) => {
    let maxLen = 10;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const len = String(cell.value ?? "").length;
      if (len > maxLen) maxLen = len;
    });
    col.width = Math.min(maxLen + 2, 40);
  });
}


// ─── PDF Generation ──────────────────────────────────────────────────────────

/**
 * Generate a one-page executive summary PDF.
 * Uses @react-pdf/renderer for JSX-based PDF layout.
 */
export async function generatePdf(
  scan: CfmScan,
  account: CfmAccount,
  recommendations: CfmRecommendation[],
): Promise<Buffer> {
  // Dynamic import to avoid bundling issues with React PDF in non-PDF contexts
  const { renderToBuffer } = await import("@react-pdf/renderer");
  const { createPdfDocument } = await import("./pdf-document");

  const doc = createPdfDocument(scan, account, recommendations);
  const buffer = await renderToBuffer(doc);
  return Buffer.from(buffer);
}
