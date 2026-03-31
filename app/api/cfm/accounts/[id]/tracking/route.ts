import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { getAccountById, getTrackingByAccount } from "@/lib/cfm/queries";
import { trackingQuerySchema } from "@/lib/cfm/validators";
import type { RecommendationLifecycleStatus } from "@/lib/cfm/types";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await requireAuth();
    const { id: accountId } = await params;

    const account = await getAccountById(accountId, userId);
    if (!account) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 },
      );
    }

    // Parse optional status filter
    const searchParams = Object.fromEntries(req.nextUrl.searchParams);
    const parsed = trackingQuerySchema.safeParse(searchParams);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: parsed.error.issues },
        { status: 400 },
      );
    }

    const tracking = await getTrackingByAccount(
      accountId,
      parsed.data.status as RecommendationLifecycleStatus | undefined,
    );

    return NextResponse.json({ tracking, total: tracking.length });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to fetch tracking records" },
      { status: 500 },
    );
  }
}
