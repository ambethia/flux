import type { Orchestrator } from "./orchestrator";

type OrchestratorAction = "enable" | "stop" | "kill" | "status";

const VALID_ACTIONS = new Set<OrchestratorAction>([
  "enable",
  "stop",
  "kill",
  "status",
]);

/**
 * Dedicated API handler for orchestrator actions.
 *
 * Accepts POST requests with JSON body `{ action: "enable" | "stop" | "kill" | "status" }`.
 * This bypasses the generic MCP tool dispatch layer (`/api/tools`), giving the UI
 * a direct, purpose-built endpoint for orchestrator control.
 *
 * The MCP tool handlers remain available for agent consumption via `/mcp`.
 */
export function createOrchestratorApiHandler(
  getOrchestrator: () => Orchestrator,
) {
  return async function handleOrchestratorApi(req: Request): Promise<Response> {
    if (req.method !== "POST") {
      return Response.json(
        { error: "Method not allowed. Use POST." },
        { status: 405 },
      );
    }

    const body = (await req.json()) as { action?: string };
    const { action } = body;

    if (!action || !VALID_ACTIONS.has(action as OrchestratorAction)) {
      return Response.json(
        {
          error: `Invalid action. Expected one of: ${[...VALID_ACTIONS].join(", ")}`,
        },
        { status: 400 },
      );
    }

    const orchestrator = getOrchestrator();

    try {
      switch (action as OrchestratorAction) {
        case "enable":
          await orchestrator.enable();
          return Response.json({ status: orchestrator.getStatus() });

        case "stop":
          await orchestrator.stop();
          return Response.json({ status: orchestrator.getStatus() });

        case "kill":
          await orchestrator.kill();
          return Response.json({ message: "Session killed." });

        case "status":
          return Response.json({ status: orchestrator.getStatus() });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return Response.json({ error: message }, { status: 500 });
    }
  };
}
