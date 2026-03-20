import { NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth/middleware";
import { writeAuditEvent } from "@/lib/audit/writer";
import { autofillRequestSchema } from "@/lib/sizing/validators";
import { callAgentSync, buildAutofillPrompt } from "@/lib/sizing/agent-client";
import type { AutofillResponse } from "@/lib/sizing/types";

/**
 * Strip markdown code fences from agent response before JSON.parse.
 */
function stripCodeFences(text: string): string {
  return text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
}

/**
 * POST /api/sizing/autofill
 * Ask the CPN Agent to provide missing pricing tiers.
 * Uses stateless agent call (store: false) — no MCP tool calls.
 */
export async function POST(request: Request) {
  try {
    const { userId } = await requireAuth();
    const body = await request.json();

    const parsed = autofillRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { services, inputTier, missingTiers } = parsed.data;

    // Log audit event (non-blocking)
    try {
      await writeAuditEvent({
        userId,
        eventType: "SIZING_AGENT_AUTOFILL",
        metadata: {
          reportType: "autofill",
          serviceCount: services.length,
          inputTier,
          filledTiers: missingTiers,
        },
      });
    } catch {
      // Audit failure must not block the primary operation
    }

    const prompt = buildAutofillPrompt(services, inputTier, missingTiers);
    const rawResponse = await callAgentSync(prompt, "");
    const cleaned = stripCodeFences(rawResponse);

    let agentData: AutofillResponse;
    try {
      agentData = JSON.parse(cleaned) as AutofillResponse;
    } catch {
      return NextResponse.json(
        { error: "Agent returned no valid pricing data" },
        { status: 422 }
      );
    }

    const results = agentData.services ?? [];

    if (results.length === 0 && services.length > 0) {
      return NextResponse.json(
        { error: "Agent returned no valid pricing data" },
        { status: 422 }
      );
    }

    return NextResponse.json({ data: { services: results } });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const message = err instanceof Error ? err.message : "Agent request failed";

    if (message.includes("not set")) {
      return NextResponse.json({ error: "Agent service unavailable" }, { status: 503 });
    }

    return NextResponse.json(
      { error: "Agent request failed", detail: message },
      { status: 502 }
    );
  }
}
