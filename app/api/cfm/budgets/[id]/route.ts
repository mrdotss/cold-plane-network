import { NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth/middleware";
import { updateBudget, deleteBudget } from "@/lib/cfm/budget-queries";
import { updateBudgetSchema } from "@/lib/cfm/validators";
import { writeAuditEvent } from "@/lib/audit/writer";

/**
 * PATCH /api/cfm/budgets/[id] — Update a budget.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await requireAuth();
    const { id } = await params;
    const body = await request.json();
    const parsed = updateBudgetSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.issues },
        { status: 400 },
      );
    }

    const budget = await updateBudget(id, userId, parsed.data);
    if (!budget) {
      return NextResponse.json({ error: "Budget not found" }, { status: 404 });
    }

    await writeAuditEvent({
      userId,
      eventType: "CFM_BUDGET_UPDATED",
      metadata: {
        budgetId: budget.id,
        monthlyLimit: Number(budget.monthlyLimit),
        enabled: budget.enabled,
      },
    });

    return NextResponse.json({ budget });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to update budget" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/cfm/budgets/[id] — Delete a budget.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await requireAuth();
    const { id } = await params;

    const deleted = await deleteBudget(id, userId);
    if (!deleted) {
      return NextResponse.json({ error: "Budget not found" }, { status: 404 });
    }

    await writeAuditEvent({
      userId,
      eventType: "CFM_BUDGET_DELETED",
      metadata: { budgetId: id },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to delete budget" },
      { status: 500 },
    );
  }
}
