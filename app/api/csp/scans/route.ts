import { NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth/middleware";
import { getAccountById } from "@/lib/cfm/queries";
import { createCspScan } from "@/lib/csp/queries";
import { startCspScanSchema } from "@/lib/csp/validators";
import { writeAuditEvent } from "@/lib/audit/writer";
import { runCspScan } from "@/lib/csp/scanner";
import { cspScanEventBus } from "@/lib/csp/scan-events";

/**
 * POST /api/csp/scans
 *
 * Start a new CSP scan for a specified account.
 * Creates a scan record (status: pending), kicks off async scan,
 * logs CSP_SCAN_STARTED audit event, and returns the scan record.
 */
export async function POST(request: Request) {
  try {
    const { userId } = await requireAuth();

    const body = await request.json();
    const parsed = startCspScanSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.issues },
        { status: 400 },
      );
    }

    const account = await getAccountById(parsed.data.accountId, userId);
    if (!account) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 },
      );
    }

    const scan = await createCspScan(account.id, userId);

    await writeAuditEvent({
      userId,
      eventType: "CSP_SCAN_STARTED",
      metadata: {
        scanId: scan.id,
        accountId: account.id,
      },
    });

    // Start the scan asynchronously
    runCspScan(
      scan.id,
      {
        id: account.id,
        awsAccountId: account.awsAccountId,
        roleArn: account.roleArn,
        externalId: account.externalId,
        regions: account.regions as string[],
      },
      (event) => {
        cspScanEventBus.emit(scan.id, event);

        if (event.type === "scan_complete") {
          writeAuditEvent({
            userId,
            eventType: "CSP_SCAN_COMPLETED",
            metadata: {
              scanId: scan.id,
              findingCount: event.summary.totalFindings,
              criticalCount: event.summary.severityBreakdown.critical,
            },
          }).catch(() => {});
        }
      },
    ).catch(() => {});

    return NextResponse.json({ scan }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to start scan" },
      { status: 500 },
    );
  }
}
