import { requireAuth, AuthError } from "@/lib/auth/middleware";
import { getCspScanById } from "@/lib/csp/queries";
import { cspScanEventBus } from "@/lib/csp/scan-events";
import type { CspScanSummary, CspScanProgressEvent } from "@/lib/csp/types";

/**
 * GET /api/csp/scans/[id]/stream
 *
 * SSE stream for real-time CSP scan progress updates.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await requireAuth();
    const { id } = await params;

    const scan = await getCspScanById(id, userId);
    if (!scan) {
      return new Response(JSON.stringify({ error: "Scan not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // If scan is already terminal, return final state immediately
    if (scan.status === "completed" || scan.status === "failed") {
      const encoder = new TextEncoder();
      const event: CspScanProgressEvent =
        scan.status === "completed" && scan.summary
          ? {
              type: "scan_complete",
              summary: scan.summary as CspScanSummary,
            }
          : { type: "scan_failed", error: scan.error ?? "Scan failed" };

      const body = `data: ${JSON.stringify(event)}\n\n`;

      return new Response(encoder.encode(body), {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    // Stream live progress events
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        const unsubscribe = cspScanEventBus.subscribe(
          id,
          (event: CspScanProgressEvent) => {
            try {
              const data = `data: ${JSON.stringify(event)}\n\n`;
              controller.enqueue(encoder.encode(data));

              if (
                event.type === "scan_complete" ||
                event.type === "scan_failed"
              ) {
                unsubscribe();
                controller.close();
              }
            } catch {
              unsubscribe();
            }
          },
        );
      },
      cancel() {},
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(
      JSON.stringify({ error: "Failed to stream scan progress" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
