import { NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth/middleware";
import { cspExportSchema } from "@/lib/csp/validators";
import { getCspScanById, getCspFindingsByScan } from "@/lib/csp/queries";
import { getAccountById } from "@/lib/cfm/queries";
import { writeAuditEvent } from "@/lib/audit/writer";
import type { CspScanSummary, CspCategory, CspSeverity } from "@/lib/csp/types";
import { CSP_CATEGORIES } from "@/lib/csp/types";

/**
 * POST /api/csp/export
 *
 * Export CSP scan results as JSON (structured report).
 * Excel/PDF generation can be added later using the same pattern as CFM.
 */
export async function POST(request: Request) {
  try {
    const { userId } = await requireAuth();

    const body = await request.json();
    const parsed = cspExportSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.issues },
        { status: 400 },
      );
    }

    const { scanId, format } = parsed.data;

    const scan = await getCspScanById(scanId, userId);
    if (!scan) {
      return NextResponse.json(
        { error: "Scan not found" },
        { status: 404 },
      );
    }

    const account = await getAccountById(scan.accountId, userId);
    if (!account) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 },
      );
    }

    const findings = await getCspFindingsByScan(scanId);
    const summary = scan.summary as CspScanSummary | null;

    // Build structured report
    const report = {
      reportType: "CSP Security Posture",
      generatedAt: new Date().toISOString(),
      account: {
        name: account.accountName,
        awsAccountId: account.awsAccountId,
        regions: account.regions,
      },
      scan: {
        id: scan.id,
        status: scan.status,
        completedAt: scan.completedAt?.toISOString() ?? null,
        securityScore: summary?.securityScore ?? null,
      },
      summary: summary ?? null,
      findingsByCategory: CSP_CATEGORIES.map((cat) => ({
        category: cat.id,
        label: cat.label,
        findings: findings
          .filter((f) => f.category === cat.id)
          .map((f) => ({
            severity: f.severity,
            service: f.service,
            resourceId: f.resourceId,
            resourceName: f.resourceName,
            finding: f.finding,
            remediation: f.remediation,
            cisReference: f.cisReference,
          })),
      })),
    };

    await writeAuditEvent({
      userId,
      eventType: "CSP_REPORT_EXPORTED",
      metadata: { scanId, format },
    });

    const dateStr = new Date().toISOString().split("T")[0];
    const safeName = account.accountName.replace(/[^a-zA-Z0-9-_]/g, "_");
    const fileName = `CSP-Report-${safeName}-${dateStr}.json`;

    return new Response(JSON.stringify(report, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
