import { serve } from "bun";
import type { Id } from "$convex/_generated/dataModel";
import index from "../index.html";
import { createMcpHandler } from "./mcp";

const DEFAULT_PORT = 8042;

export async function startServer(
  projectId: Id<"projects">,
  projectSlug: string,
) {
  const port = Number(process.env.FLUX_PORT) || DEFAULT_PORT;
  const handleMcp = createMcpHandler(projectId, projectSlug);

  const server = serve({
    port,
    idleTimeout: 0,
    routes: {
      "/health": () =>
        Response.json({
          status: "ok",
          timestamp: Date.now(),
          uptime: process.uptime(),
        }),

      "/mcp": (req) => handleMcp(req),

      // Serve React app for all unmatched routes (SPA fallback).
      "/*": index,
    },
    development: process.env.NODE_ENV !== "production" && {
      hmr: true,
      console: false,
    },
  });

  return server;
}
