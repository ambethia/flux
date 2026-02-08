import { join } from "node:path";
import { serve } from "bun";
import type { Id } from "$convex/_generated/dataModel";
import { createApiHandler } from "./api";
import { getConvexClient } from "./convex";
import { createMcpHandler } from "./mcp";
import { getOrchestrator } from "./orchestrator";
import { createOrchestratorApiHandler } from "./orchestratorApi";
import { createProjectsApiHandler } from "./projectsApi";
import { createSSEHandler } from "./sse";
import type { ToolContext } from "./tools";

const DEFAULT_PORT = 8042;

export async function startServer(
  projectId: Id<"projects">,
  projectSlug: string,
) {
  const port = Number(process.env.FLUX_PORT) || DEFAULT_PORT;
  const handleMcp = createMcpHandler(projectId, projectSlug);

  const toolContext: ToolContext = {
    convex: getConvexClient(),
    projectId,
    projectSlug,
    getOrchestrator: () => getOrchestrator(projectId),
  };
  const handleApi = createApiHandler(toolContext);
  const handleSSE = createSSEHandler(() => getOrchestrator(projectId));
  const handleOrchestratorApi = createOrchestratorApiHandler(() =>
    getOrchestrator(projectId),
  );
  const handleProjectsApi = createProjectsApiHandler(getConvexClient());

  const routes: Record<
    string,
    Response | ((req: Request) => Response | Promise<Response>)
  > = {
    "/health": () =>
      Response.json({
        status: "ok",
        timestamp: Date.now(),
        uptime: process.uptime(),
      }),

    "/api/config": () => {
      const convexUrl = process.env.CONVEX_URL;
      if (!convexUrl) {
        return Response.json(
          { error: "CONVEX_URL not configured" },
          { status: 500 },
        );
      }
      return Response.json({ convexUrl, projectId });
    },

    "/mcp": (req) => handleMcp(req),
    "/api/tools": (req) => handleApi(req),
    "/api/orchestrator": (req) => handleOrchestratorApi(req),
    "/api/projects": (req) => handleProjectsApi(req),
    "/api/projects/*": (req) => handleProjectsApi(req),
    "/sse/activity": (req) => handleSSE(req),
  };

  // In production, serve the Vite-built frontend from dist/.
  if (process.env.NODE_ENV === "production") {
    const distDir = join(import.meta.dir, "../../dist");
    routes["/*"] = async (req: Request) => {
      const url = new URL(req.url);
      const filePath = url.pathname === "/" ? "/index.html" : url.pathname;
      const file = Bun.file(join(distDir, filePath));
      if (await file.exists()) return new Response(file);
      // SPA fallback: serve index.html for client-side routes.
      return new Response(Bun.file(join(distDir, "index.html")), {
        headers: { "Content-Type": "text/html" },
      });
    };
  }

  const server = serve({
    port,
    idleTimeout: 0,
    routes,
  });

  return server;
}
