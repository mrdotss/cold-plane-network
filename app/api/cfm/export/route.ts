import { NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth/middleware";
import { exportSchema } from "@/lib/cfm/validators";
import { getScanById, getAccountById, getRecommendationsByScan } from "@/lib/cfm/queries";
import { generateExcel, generatePdf } from "@/lib/cfm/export-generator";
import { writeAuditEvent } from "@/lib/audit/writer";
import type { CfmAccount, CfmScan, CfmRecommendation } from "@/lib/cfm/types";

/**
 * POST /api/cfm/export
 *
 * Generate and download a CFM report in Excel or PDF format.
 * Validates ownership, generates the file, logs audit event,
 * and returns binary with Content-Disposition header.
 */
export async function POST(request: Request) {
  try {
    const { userId } = await requireAuth();

    const body = await request.json();
    const parsed = exportSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.issues },
        { status: 400 },
      );
    }

    const { scanId, format } = parsed.data;

    const scan = await getScanById(scanId, userId);
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

    const rawRecs = await getRecommendationsByScan(scanId);

    // Map DB records to typed CfmRecommendation objects
    const recommendations: CfmRecommendation[] = rawRecs.map((r) => ({
      id: r.id,
      scanId: r.scanId,
      service: r.service,
      resourceId: r.resourceId,
      resourceName: r.resourceName,
      priority: r.priority as CfmRecommendation["priority"],
      recommendation: r.recommendation,
      currentCost: Number(r.currentCost),
      estimatedSavings: Number(r.estimatedSavings),
      effort: r.effort as CfmRecommendation["effort"],
      metadata: (r.metadata ?? {}) as Record<string, unknown>,
      createdAt: r.createdAt,
    }));

    // Map DB record to typed CfmScan
    const typedScan: CfmScan = {
      id: scan.id,
      accountId: scan.accountId,
      userId: scan.userId,
      status: scan.status as CfmScan["status"],
      summary: scan.summary as CfmScan["summary"],
      azureConversationId: scan.azureConversationId,
      error: scan.error,
      createdAt: scan.createdAt,
      completedAt: scan.completedAt,
    };

    // Map DB record to typed CfmAccount
    const typedAccount: CfmAccount = {
      id: account.id,
      userId: account.userId,
      accountName: account.accountName,
      awsAccountId: account.awsAccountId,
      roleArn: account.roleArn,
      externalId: account.externalId,
      regions: account.regions as string[],
      services: account.services as string[],
      lastScanAt: account.lastScanAt,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    };

    const dateStr = new Date().toISOString().split("T")[0];
    const safeName = account.accountName.replace(/[^a-zA-Z0-9-_]/g, "_");

    let fileBuffer: Buffer | ArrayBuffer;
    let contentType: string;
    let fileName: string;

    if (format === "excel") {
      const workbook = await generateExcel(typedScan, typedAccount, recommendations);
      const buffer = await workbook.xlsx.writeBuffer();
      fileBuffer = buffer;
      contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      fileName = `CFM-Report-${safeName}-${dateStr}.xlsx`;
    } else {
      fileBuffer = await generatePdf(typedScan, typedAccount, recommendations);
      contentType = "application/pdf";
      fileName = `CFM-Report-${safeName}-${dateStr}.pdf`;
    }

    // Log audit event
    await writeAuditEvent({
      userId,
      eventType: "CFM_REPORT_EXPORTED",
      metadata: { scanId, format },
    });

    return new Response(new Uint8Array(fileBuffer instanceof Buffer ? fileBuffer : fileBuffer as ArrayBuffer), {
      status: 200,
      headers: {
        "Content-Type": contentType,
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
