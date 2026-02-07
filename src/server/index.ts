import { serve } from "bun";
import index from "../index.html";

const DEFAULT_PORT = 8042;

export function startServer() {
  const port = Number(process.env.FLUX_PORT) || DEFAULT_PORT;

  const server = serve({
    port,
    routes: {
      "/health": () =>
        Response.json({
          status: "ok",
          timestamp: Date.now(),
          uptime: process.uptime(),
        }),

      // MCP endpoint — stub until F2 implements @modelcontextprotocol/sdk
      "/mcp": {
        POST: () =>
          Response.json(
            { error: "MCP not implemented" },
            { status: 501 },
          ),
      },

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
