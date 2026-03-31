import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import {
  getAccountById,
  updateTrackingStatus,
} from "@/lib/cfm/queries";
import { updateTrackingSchema } from "@/lib/cfm/validators";
import { writeAuditEvent } from "@/lib/audit/writer";
import {
  LIFECYCLE_TRANSITIONS,
  type RecommendationLifecycleStatus,
} from "@/lib/cfm/types";
import { db } from "@/lib/db/client";
import { cfmRecommendationTracking } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function PATCH(
  req: NextRequest,
  {
    params,
  }: { params: Promise<{ id: string; trackingId: string }> },
) {
  try {
    const { userId } = await requireAuth();
    const { id: accountId, trackingId } = await params;

    // Verify account ownership
    const account = await getAccountById(accountId, userId);
    if (!account) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 },
      );
    }

    // Parse request body
    const body = await req.json();
    const parsed = updateTrackingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid tracking data", details: parsed.error.issues },
        { status: 400 },
      );
    }

    const { status: newStatus, notes } = parsed.data;

    // Fetch current tracking record
    const [current] = await db
      .select()
      .from(cfmRecommendationTracking)
      .where(
        and(
          eq(cfmRecommendationTracking.id, trackingId),
          eq(cfmRecommendationTracking.accountId, accountId),
        ),
      )
      .limit(1);

    if (!current) {
      return NextResponse.json(
        { error: "Tracking record not found" },
        { status: 404 },
      );
    }

    // Validate transition
    const currentStatus =
      current.status as RecommendationLifecycleStatus;
    const validTransitions = LIFECYCLE_TRANSITIONS[currentStatus];
    if (
      !validTransitions.includes(
        newStatus as RecommendationLifecycleStatus,
      )
    ) {
      return NextResponse.json(
        {
          error: `Invalid transition: cannot move from "${currentStatus}" to "${newStatus}". Valid transitions: ${validTransitions.join(", ") || "none (terminal state)"}`,
        },
        { status: 422 },
      );
    }

    // Update status
    const updated = await updateTrackingStatus(
      trackingId,
      accountId,
      newStatus as RecommendationLifecycleStatus,
      notes,
    );

    if (!updated) {
      return NextResponse.json(
        { error: "Failed to update tracking record" },
        { status: 500 },
      );
    }

    // Audit log
    writeAuditEvent({
      userId,
      eventType: "CFM_RECOMMENDATION_STATUS_CHANGED",
      metadata: {
        trackingId,
        accountId,
        resourceId: current.resourceId,
        fromStatus: currentStatus,
        toStatus: newStatus,
      },
    }).catch(() => {});

    return NextResponse.json({ tracking: updated });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to update tracking status" },
      { status: 500 },
    );
  }
}
