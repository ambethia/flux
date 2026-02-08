import type { OrchestratorStatusData } from "@/shared/orchestrator";

type OrchestratorAction = "enable" | "stop" | "kill" | "status";

/**
 * Call the dedicated orchestrator API endpoint.
 *
 * Unlike `callTool`, this goes directly to `/api/orchestrator` — a purpose-built
 * route that skips the generic MCP tool dispatch layer.
 */
async function callOrchestratorApi<T = unknown>(
  action: OrchestratorAction,
): Promise<T> {
  const res = await fetch("/api/orchestrator", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const message =
      (body as { error?: string })?.error ??
      `Orchestrator action failed: ${res.status} ${res.statusText}`;
    throw new Error(message);
  }

  return (await res.json()) as T;
}

/** Enable the orchestrator scheduler. */
export function enableOrchestrator(): Promise<OrchestratorStatusData> {
  return callOrchestratorApi<OrchestratorStatusData>("enable");
}

/** Gracefully stop the orchestrator scheduler. */
export function stopOrchestrator(): Promise<OrchestratorStatusData> {
  return callOrchestratorApi<OrchestratorStatusData>("stop");
}

/** Kill the active session (SIGTERM). */
export function killOrchestrator(): Promise<{ message: string }> {
  return callOrchestratorApi<{ message: string }>("kill");
}

/** Fetch current orchestrator status. */
export function fetchOrchestratorStatus(): Promise<OrchestratorStatusData> {
  return callOrchestratorApi<OrchestratorStatusData>("status");
}
