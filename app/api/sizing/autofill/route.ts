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
 * Uses the same agent call pattern as /api/sizing/recommend (no MCP tool calls).
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

    // Build prompt and call agent (same pattern as recommend — no MCP tool calls)
    const prompt = buildAutofillPrompt(services, inputTier, missingTiers);

    console.log("\n========== [sizing/autofill] REQUEST ==========");
    console.log("Services count:", services.length);
    console.log("Input tier:", inputTier);
    console.log("Missing tiers:", missingTiers);
    console.log("Services:", JSON.stringify(services, null, 2));
    console.log("Prompt length:", prompt.length);
    console.log("--- PROMPT START ---");
    console.log(prompt);
    console.log("--- PROMPT END ---");

    const rawResponse = await callAgentSync(prompt, "");

    console.log("\n========== [sizing/autofill] RESPONSE ==========");
    console.log("Raw response length:", rawResponse.length);
    console.log("--- RAW RESPONSE START ---");
    console.log(rawResponse);
    console.log("--- RAW RESPONSE END ---");

    const cleaned = stripCodeFences(rawResponse);

    console.log("--- CLEANED JSON START ---");
    console.log(cleaned);
    console.log("--- CLEANED JSON END ---");

    let agentData: AutofillResponse;
    try {
      agentData = JSON.parse(cleaned) as AutofillResponse;
    } catch {
      console.error("[sizing/autofill] Failed to parse agent JSON");
      return NextResponse.json(
        { error: "Agent returned no valid pricing data" },
        { status: 422 }
      );
    }

    const results = agentData.services ?? [];

    console.log("\n========== [sizing/autofill] PARSED ==========");
    console.log("Parsed services count:", results.length);
    console.log("Parsed services:", JSON.stringify(results, null, 2));
    console.log("==============================================\n");

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
    console.error("[sizing/autofill] Agent error:", message);

    if (message.includes("not set")) {
      return NextResponse.json({ error: "Agent service unavailable" }, { status: 503 });
    }

    return NextResponse.json(
      { error: "Agent request failed", detail: message },
      { status: 502 }
    );
  }
}
