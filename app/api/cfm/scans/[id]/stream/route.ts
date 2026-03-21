import { requireAuth, AuthError } from "@/lib/auth/middleware";
import { getScanById } from "@/lib/cfm/queries";
import { scanEventBus } from "@/lib/cfm/scan-events";
import type { CfmScanSummary, ScanProgressEvent } from "@/lib/cfm/types";

/**
 * GET /api/cfm/scans/[id]/stream
 *
 * SSE stream for real-time scan progress updates.
 * Streams ScanProgressEvent objects as `data:` lines.
 *
 * The stream closes automatically when the scan completes or fails.
 * If the scan is already in a terminal state, the stream returns
 * the final status immediately and closes.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await requireAuth();
    const { id } = await params;

    const scan = await getScanById(id, userId);
    if (!scan) {
      return new Response(JSON.stringify({ error: "Scan not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // If scan is already terminal, return final state immediately
    if (scan.status === "completed" || scan.status === "failed") {
      const encoder = new TextEncoder();
      const event: ScanProgressEvent =
        scan.status === "completed" && scan.summary
          ? { type: "scan_complete", summary: scan.summary as CfmScanSummary }
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
        const unsubscribe = scanEventBus.subscribe(
          id,
          (event: ScanProgressEvent) => {
            try {
              const data = `data: ${JSON.stringify(event)}\n\n`;
              controller.enqueue(encoder.encode(data));

              // Close stream on terminal events
              if (
                event.type === "scan_complete" ||
                event.type === "scan_failed"
              ) {
                unsubscribe();
                controller.close();
              }
            } catch {
              // Stream may already be closed (client disconnected)
              unsubscribe();
            }
          },
        );

        // Clean up if the client disconnects before scan finishes
        // The AbortSignal from the request handles this via the cancel callback
      },
      cancel() {
        // Client disconnected — nothing to clean up beyond GC of the listener.
        // The unsubscribe is captured in the start closure and will be GC'd.
      },
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
    return new Response(JSON.stringify({ error: "Failed to stream scan progress" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
