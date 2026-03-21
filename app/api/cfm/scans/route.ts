import { NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth/middleware";
import { getAccountById, createScan } from "@/lib/cfm/queries";
import { startScanSchema } from "@/lib/cfm/validators";
import { writeAuditEvent } from "@/lib/audit/writer";
import { runScan } from "@/lib/cfm/scanner";
import { scanEventBus } from "@/lib/cfm/scan-events";
import type { CfmAccount } from "@/lib/cfm/types";

/**
 * POST /api/cfm/scans
 *
 * Start a new CFM scan for a specified account.
 * Creates a scan record (status: pending), kicks off async scan,
 * logs CFM_SCAN_STARTED audit event, and returns the scan record.
 */
export async function POST(request: Request) {
  try {
    const { userId } = await requireAuth();

    const body = await request.json();
    const parsed = startScanSchema.safeParse(body);

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

    const scan = await createScan(account.id, userId);

    await writeAuditEvent({
      userId,
      eventType: "CFM_SCAN_STARTED",
      metadata: {
        scanId: scan.id,
        accountId: account.id,
        services: account.services,
        regions: account.regions,
      },
    });

    // Start the scan asynchronously — don't await it.
    // The client will poll or use SSE to track progress.
    const cfmAccount: CfmAccount = {
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

    runScan(scan.id, cfmAccount, (event) => {
      scanEventBus.emit(scan.id, event);

      // Log CFM_SCAN_COMPLETED audit event when scan finishes
      if (event.type === "scan_complete") {
        writeAuditEvent({
          userId,
          eventType: "CFM_SCAN_COMPLETED",
          metadata: {
            scanId: scan.id,
            totalSavings: event.summary.totalPotentialSavings,
            recommendationCount: event.summary.recommendationCount,
          },
        }).catch(() => {
          // Best-effort audit logging
        });
      }
    }).catch(() => {
      // Error handling is done inside runScan (updates scan status to failed).
      // This catch prevents unhandled promise rejection.
    });

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
