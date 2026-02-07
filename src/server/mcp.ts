import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import type { Id } from "$convex/_generated/dataModel";
import { api } from "$convex/_generated/api";
import { getConvexClient } from "./convex";

type Session = {
  transport: WebStandardStreamableHTTPServerTransport;
  server: McpServer;
};

const sessions = new Map<string, Session>();

function registerTools(
  mcp: McpServer,
  projectId: Id<"projects">,
  projectSlug: string,
) {
  const convex = getConvexClient();

  function buildMeta() {
    return { project: projectSlug, timestamp: Date.now() };
  }

  mcp.tool(
    "issues_create",
    "Create a new issue in the project. Returns the created issue with its assigned shortId.",
    {
      title: z
        .string()
        .describe("Issue title. Be specific and actionable."),
      description: z
        .string()
        .optional()
        .describe("Detailed description. Supports markdown."),
      priority: z
        .enum(["critical", "high", "medium", "low"])
        .optional()
        .describe(
          "Defaults to 'medium'. Use 'critical' only for drop-everything issues.",
        ),
    },
    async ({ title, description, priority }) => {
      const issueId = await convex.mutation(api.issues.create, {
        projectId,
        title,
        description,
        priority,
      });
      const issue = await convex.query(api.issues.get, {
        issueId: issueId as Id<"issues">,
      });
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ issue, _meta: buildMeta() }),
          },
        ],
      };
    },
  );

  mcp.tool(
    "issues_list",
    "List issues sorted by priority (critical first) then creation time (oldest first).",
    {
      status: z
        .enum(["open", "in_progress", "closed"])
        .optional()
        .describe("Filter by status. Omit for all."),
      limit: z
        .number()
        .optional()
        .describe("Max results. Default 50, max 200."),
    },
    async ({ status, limit }) => {
      const issues = await convex.query(api.issues.list, {
        projectId,
        status,
        limit: Math.min(limit ?? 50, 200),
      });
      // Strip descriptions from list (token efficiency)
      const summary = issues.map(
        ({ description: _description, ...rest }) => rest,
      );
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              issues: summary,
              count: summary.length,
              _meta: buildMeta(),
            }),
          },
        ],
      };
    },
  );

  mcp.tool(
    "issues_get",
    "Get full details for a single issue, including its description.",
    {
      issueId: z
        .string()
        .describe(
          "The issue's document ID (from issues_list or issues_create).",
        ),
    },
    async ({ issueId }) => {
      const issue = await convex.query(api.issues.get, {
        issueId: issueId as Id<"issues">,
      });
      if (!issue) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Issue not found: ${issueId}. Use issues_list to find valid IDs.`,
            },
          ],
          isError: true,
        };
      }
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ issue, _meta: buildMeta() }),
          },
        ],
      };
    },
  );

  mcp.tool(
    "issues_update",
    "Update an existing issue. Pass only the fields you want to change.",
    {
      issueId: z
        .string()
        .describe("The issue's document ID."),
      title: z
        .string()
        .optional()
        .describe("New title."),
      description: z
        .string()
        .optional()
        .describe("New description. Supports markdown."),
      status: z
        .enum(["open", "in_progress", "closed"])
        .optional()
        .describe("New status."),
      priority: z
        .enum(["critical", "high", "medium", "low"])
        .optional()
        .describe("New priority."),
      assignee: z
        .string()
        .optional()
        .describe("Assign to an agent or person."),
    },
    async ({ issueId, ...updates }) => {
      const updated = await convex.mutation(api.issues.update, {
        issueId: issueId as Id<"issues">,
        ...updates,
      });
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ issue: updated, _meta: buildMeta() }),
          },
        ],
      };
    },
  );
}

export function createMcpHandler(
  projectId: Id<"projects">,
  projectSlug: string,
) {
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
              message: "Session not found. Send an initialize request to start a new session.",
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
    registerTools(mcp, projectId, projectSlug);
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
