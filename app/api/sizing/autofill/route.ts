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
 * Returns a JSON response with the autofill results.
 *
 * Uses a SINGLE callAgentSync() call with ALL services in one prompt
 * to avoid multiplying API costs and latency.
 */
export async function POST(request: Request) {
  // --- Auth ---
  let userId: string;
  try {
    ({ userId } = await requireAuth());
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // --- Validation ---
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = autofillRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const { services, inputTier, missingTiers } = parsed.data;
  const totalServices = services.length;

  // Log audit event (non-blocking)
  try {
    await writeAuditEvent({
      userId,
      eventType: "SIZING_AGENT_AUTOFILL",
      metadata: {
        reportType: "autofill",
        serviceCount: totalServices,
        inputTier,
        filledTiers: missingTiers,
      },
    });
  } catch {
    // Audit failure must not block the primary operation
  }

  // --- Call agent and parse response ---
  try {
    const prompt = buildAutofillPrompt(services, inputTier, missingTiers);
    const rawResponse = await callAgentSync(prompt, "");
    const cleaned = stripCodeFences(rawResponse);

    let agentData: AutofillResponse;
    try {
      agentData = JSON.parse(cleaned) as AutofillResponse;
    } catch {
      return NextResponse.json(
        { error: "Agent returned no valid pricing data" },
        { status: 502 },
      );
    }

    const results = agentData.services ?? [];

    if (results.length === 0 && totalServices > 0) {
      return NextResponse.json(
        { error: "Agent returned no valid pricing data" },
        { status: 502 },
      );
    }

    return NextResponse.json({ services: results });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Agent request failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
