import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { Id } from "$convex/_generated/dataModel";
import { getConvexClient } from "./convex";
import { getOrchestrator } from "./orchestrator";
import { allTools, handlers, type ToolContext } from "./tools";

type Session = {
  transport: WebStandardStreamableHTTPServerTransport;
  server: McpServer;
};

const sessions = new Map<string, Session>();

function registerTools(mcp: McpServer, ctx: ToolContext) {
  for (const tool of allTools) {
    const handler = handlers[tool.name];

    if (handler) {
      // Implemented — delegate to shared handler
      mcp.tool(tool.name, tool.description, tool.schema, async (args) => {
        return handler(args as Record<string, unknown>, ctx);
      });
    } else {
      // Stub — return "not implemented" for tools without handlers yet
      mcp.tool(tool.name, tool.description, tool.schema, async () => {
        return {
          content: [
            { type: "text" as const, text: `Not implemented: ${tool.name}` },
          ],
          isError: true,
        };
      });
    }
  }
}

export function createMcpHandler(
  projectId: Id<"projects">,
  projectSlug: string,
) {
  const ctx: ToolContext = {
    convex: getConvexClient(),
    projectId,
    projectSlug,
    getOrchestrator: () => getOrchestrator(projectId),
  };

  return async function handleMcpRequest(req: Request): Promise<Response> {
    const sessionId = req.headers.get("mcp-session-id");

    // Existing session — route to its transport
    if (sessionId) {
      const session = sessions.get(sessionId);
      if (!session) {
        return Response.json(
          {
            jsonrpc: "2.0",
            error: {
              code: -32000,
              message:
                "Session not found. Send an initialize request to start a new session.",
            },
            id: null,
          },
          { status: 400 },
        );
      }

      if (req.method === "DELETE") {
        await session.server.close();
        sessions.delete(sessionId);
        return new Response(null, { status: 204 });
      }

      return session.transport.handleRequest(req);
    }

    // New session — create server + transport, handle initialize
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
      enableJsonResponse: true,
    });

    const mcp = new McpServer({ name: "flux", version: "0.1.0" });
    registerTools(mcp, ctx);
    await mcp.connect(transport);

    const response = await transport.handleRequest(req);

    // Store session for subsequent requests
    if (transport.sessionId) {
      sessions.set(transport.sessionId, { transport, server: mcp });
      transport.onclose = () => {
        if (transport.sessionId) sessions.delete(transport.sessionId);
      };
    }

    return response;
  };
}
