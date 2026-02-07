import { useCallback, useEffect, useRef, useState } from "react";

/** Event types from the SSE endpoint */
export interface SessionStartEvent {
  type: "session_start";
  sessionId: string;
  issueId: string;
  pid: number;
}

export interface ActivityEvent {
  type: "activity";
  content: string;
}

export interface StatusEvent {
  type: "status";
  state: "stopped" | "idle" | "busy";
  message: string;
}

export type StreamEvent = SessionStartEvent | ActivityEvent | StatusEvent;

export interface ActivityStreamState {
  events: StreamEvent[];
  connected: boolean;
}

const MAX_EVENTS = 2000;

/**
 * Hook that connects to /sse/activity and streams live agent output.
 * Handles reconnection on disconnect with exponential backoff.
 */
export function useActivityStream(): ActivityStreamState & {
  clear: () => void;
} {
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const retryDelay = useRef(1000);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => setEvents([]), []);

  useEffect(() => {
    let es: EventSource | null = null;
    let disposed = false;

    function connect() {
      if (disposed) return;
      es = new EventSource("/sse/activity");

      es.addEventListener("open", () => {
        setConnected(true);
        retryDelay.current = 1000; // Reset backoff on successful connect
      });

      es.addEventListener("session_start", (e: MessageEvent) => {
        const data = JSON.parse(e.data) as {
          sessionId: string;
          issueId: string;
          pid: number;
        };
        setEvents((prev) => {
          const next = [
            ...prev,
            {
              type: "session_start" as const,
              sessionId: data.sessionId,
              issueId: data.issueId,
              pid: data.pid,
            },
          ];
          return next.length > MAX_EVENTS ? next.slice(-MAX_EVENTS) : next;
        });
      });

      es.addEventListener("activity", (e: MessageEvent) => {
        const data = JSON.parse(e.data) as { type: string; content: string };
        setEvents((prev) => {
          const next = [
            ...prev,
            { type: "activity" as const, content: data.content },
          ];
          return next.length > MAX_EVENTS ? next.slice(-MAX_EVENTS) : next;
        });
      });

      es.addEventListener("status", (e: MessageEvent) => {
        const data = JSON.parse(e.data) as {
          state: "stopped" | "idle" | "busy";
          message: string;
        };
        setEvents((prev) => {
          const next = [
            ...prev,
            {
              type: "status" as const,
              state: data.state,
              message: data.message,
            },
          ];
          return next.length > MAX_EVENTS ? next.slice(-MAX_EVENTS) : next;
        });
      });

      es.addEventListener("error", () => {
        setConnected(false);
        es?.close();
        es = null;
        // Reconnect with exponential backoff (max 30s)
        if (!disposed) {
          retryTimer.current = setTimeout(() => {
            retryDelay.current = Math.min(retryDelay.current * 2, 30_000);
            connect();
          }, retryDelay.current);
        }
      });
    }

    connect();

    return () => {
      disposed = true;
      es?.close();
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
  }, []);

  return { events, connected, clear };
}
