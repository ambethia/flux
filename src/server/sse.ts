import type { Orchestrator } from "./orchestrator";

/**
 * Create an SSE handler for the /sse/activity endpoint.
 * Streams live agent output to connected browsers.
 */
export function createSSEHandler(getOrchestrator: () => Orchestrator) {
  return (req: Request): Response => {
    const monitor = getOrchestrator().getActiveMonitor();
    const status = getOrchestrator().getStatus();
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      start(controller) {
        // Send current session info if active
        if (status.activeSession) {
          controller.enqueue(
            encoder.encode(
              formatSSE("session_start", {
                sessionId: status.activeSession.sessionId,
                issueId: status.activeSession.issueId,
                pid: status.activeSession.pid,
              }),
            ),
          );
        }

        // Send buffered history
        if (monitor) {
          for (const line of monitor.buffer.getAll()) {
            controller.enqueue(
              encoder.encode(
                formatSSE("activity", { type: "line", content: line }),
              ),
            );
          }
        }

        // Stream new lines as they arrive
        if (monitor) {
          const unsubscribe = monitor.onLine((line) => {
            try {
              controller.enqueue(
                encoder.encode(
                  formatSSE("activity", { type: "line", content: line }),
                ),
              );
            } catch {
              // Controller closed — client disconnected
              unsubscribe();
            }
          });

          // Clean up when client disconnects
          req.signal.addEventListener("abort", () => {
            unsubscribe();
            try {
              controller.close();
            } catch {
              // Already closed
            }
          });
        } else {
          // No active session — send status and close
          controller.enqueue(
            encoder.encode(
              formatSSE("status", {
                state: status.state,
                message: "No active session",
              }),
            ),
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  };
}

/** Format a Server-Sent Event message. */
function formatSSE(event: string, data: object): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}
