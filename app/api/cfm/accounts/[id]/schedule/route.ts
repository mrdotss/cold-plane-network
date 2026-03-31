import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import {
  getAccountById,
  getScheduleByAccount,
  upsertSchedule,
  deleteSchedule,
} from "@/lib/cfm/queries";
import { upsertScheduleSchema } from "@/lib/cfm/validators";
import { computeNextRunAt } from "@/lib/cfm/scheduler";
import { writeAuditEvent } from "@/lib/audit/writer";
import type { ScheduleFrequency } from "@/lib/cfm/types";

export async function GET(
  _req: NextRequest,
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

    const schedule = await getScheduleByAccount(accountId);
    return NextResponse.json({ schedule: schedule ?? null });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to fetch schedule" },
      { status: 500 },
    );
  }
}

export async function PUT(
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

    const body = await req.json();
    const parsed = upsertScheduleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid schedule data", details: parsed.error.issues },
        { status: 400 },
      );
    }

    const { frequency, dayOfWeek, dayOfMonth, hour, enabled } = parsed.data;

    // Compute the next run time
    const nextRunAt = enabled
      ? computeNextRunAt(
          frequency as ScheduleFrequency,
          hour,
          dayOfWeek,
          dayOfMonth,
        )
      : null;

    // Check if schedule already exists for audit event type
    const existing = await getScheduleByAccount(accountId);
    const eventType = existing ? "CFM_SCHEDULE_UPDATED" : "CFM_SCHEDULE_CREATED";

    const schedule = await upsertSchedule(accountId, userId, {
      frequency,
      dayOfWeek,
      dayOfMonth,
      hour,
      enabled,
      nextRunAt: nextRunAt ?? undefined,
    });

    writeAuditEvent({
      userId,
      eventType,
      metadata: { accountId, frequency, hour, enabled },
    }).catch(() => {});

    return NextResponse.json({ schedule });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to save schedule" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _req: NextRequest,
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

    const deleted = await deleteSchedule(accountId, userId);
    if (!deleted) {
      return NextResponse.json(
        { error: "No schedule found for this account" },
        { status: 404 },
      );
    }

    writeAuditEvent({
      userId,
      eventType: "CFM_SCHEDULE_DELETED",
      metadata: { accountId },
    }).catch(() => {});

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to delete schedule" },
      { status: 500 },
    );
  }
}
