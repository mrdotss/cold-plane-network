import { NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth/middleware";
import { writeAuditEvent } from "@/lib/audit/writer";
import { recommendRequestSchema } from "@/lib/sizing/validators";
import { callAgent, callAgentSync } from "@/lib/sizing/agent-client";

/**
 * POST /api/sizing/recommend
 * Proxy to Azure AI Foundry agent.
 * Query param: ?stream=true for SSE, omit for full JSON response.
 */
export async function POST(request: Request) {
  try {
    const { userId } = await requireAuth();
    const body = await request.json();

    const parsed = recommendRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { pricingContext, userDescription } = parsed.data;
    const url = new URL(request.url);
    const stream = url.searchParams.get("stream") === "true";

    // Log audit event (non-blocking)
    try {
      await writeAuditEvent({
        userId,
        eventType: "SIZING_AGENT_RECOMMEND",
        metadata: {
          reportType: "recommend",
          serviceCount: 0,
          promptLength: pricingContext.length + userDescription.length,
        },
      });
    } catch {
      // Audit failure must not block the primary operation
    }

    if (stream) {
      const agentStream = await callAgent(pricingContext, userDescription);
      return new Response(agentStream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    const response = await callAgentSync(pricingContext, userDescription);
    return NextResponse.json({ data: { response } });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const message = err instanceof Error ? err.message : "Agent request failed";
    console.error("[sizing/recommend] Agent error:", message);

    if (message.includes("not set")) {
      return NextResponse.json({ error: "Agent service unavailable" }, { status: 503 });
    }
    if (message.includes("token") || message.includes("authentication")) {
      return NextResponse.json({ error: "Agent authentication failed", detail: message }, { status: 502 });
    }

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
