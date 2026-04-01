import { NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth/middleware";
import {
  getBudgetsWithUtilization,
  createBudget,
} from "@/lib/cfm/budget-queries";
import { createBudgetSchema } from "@/lib/cfm/validators";
import { writeAuditEvent } from "@/lib/audit/writer";

/**
 * GET /api/cfm/budgets — List all budgets with utilization data.
 */
export async function GET() {
  try {
    const { userId } = await requireAuth();
    const budgets = await getBudgetsWithUtilization(userId);
    return NextResponse.json({ budgets });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to fetch budgets" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/cfm/budgets — Create a new budget.
 */
export async function POST(request: Request) {
  try {
    const { userId } = await requireAuth();
    const body = await request.json();
    const parsed = createBudgetSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.issues },
        { status: 400 },
      );
    }

    const budget = await createBudget(userId, parsed.data);

    await writeAuditEvent({
      userId,
      eventType: "CFM_BUDGET_CREATED",
      metadata: {
        budgetId: budget.id,
        targetType: parsed.data.accountId ? "account" : "group",
        targetId: parsed.data.accountId ?? parsed.data.groupId,
        monthlyLimit: parsed.data.monthlyLimit,
      },
    });

    return NextResponse.json({ budget }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to create budget" },
      { status: 500 },
    );
  }
}
