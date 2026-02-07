import type { ConvexClient } from "convex/browser";
import { api } from "$convex/_generated/api";
import type { Id } from "$convex/_generated/dataModel";
import type { Orchestrator } from "../orchestrator";

export type ToolContext = {
  convex: ConvexClient;
  projectId: Id<"projects">;
  projectSlug: string;
  getOrchestrator: () => Orchestrator;
};

export type ToolResult = {
  content: { type: "text"; text: string }[];
  isError?: boolean;
};

export type ToolHandler = (
  args: Record<string, unknown>,
  ctx: ToolContext,
) => Promise<ToolResult>;

function buildMeta(ctx: ToolContext) {
  return { project: ctx.projectSlug, timestamp: Date.now() };
}

function ok(ctx: ToolContext, data: Record<string, unknown>): ToolResult {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({ ...data, _meta: buildMeta(ctx) }),
      },
    ],
  };
}

function error(message: string): ToolResult {
  return {
    content: [{ type: "text", text: message }],
    isError: true,
  };
}

// ── Handlers ──────────────────────────────────────────────────────────

const issues_create: ToolHandler = async (args, ctx) => {
  const { title, description, priority } = args as {
    title: string;
    description?: string;
    priority?: "critical" | "high" | "medium" | "low";
  };

  const issueId = await ctx.convex.mutation(api.issues.create, {
    projectId: ctx.projectId,
    title,
    description,
    priority,
  });
  const issue = await ctx.convex.query(api.issues.get, {
    issueId: issueId as Id<"issues">,
  });
  return ok(ctx, { issue });
};

const issues_list: ToolHandler = async (args, ctx) => {
  const { status, limit } = args as {
    status?: "open" | "in_progress" | "closed";
    limit?: number;
  };

  const issues = await ctx.convex.query(api.issues.list, {
    projectId: ctx.projectId,
    status,
    limit: Math.min(limit ?? 50, 200),
  });
  // Strip descriptions from list (token efficiency)
  const summary = issues.map(({ description: _description, ...rest }) => rest);
  return ok(ctx, { issues: summary, count: summary.length });
};

const issues_get: ToolHandler = async (args, ctx) => {
  const { issueId } = args as { issueId: string };

  const issue = await ctx.convex.query(api.issues.get, {
    issueId: issueId as Id<"issues">,
  });
  if (!issue) {
    return error(
      `Issue not found: ${issueId}. Use issues_list to find valid IDs.`,
    );
  }
  return ok(ctx, { issue });
};

const issues_update: ToolHandler = async (args, ctx) => {
  const { issueId, ...updates } = args as {
    issueId: string;
    title?: string;
    description?: string;
    status?: "open" | "in_progress" | "closed";
    priority?: "critical" | "high" | "medium" | "low";
    assignee?: string;
  };

  const updated = await ctx.convex.mutation(api.issues.update, {
    issueId: issueId as Id<"issues">,
    ...updates,
  });
  return ok(ctx, { issue: updated });
};

const orchestrator_run: ToolHandler = async (args, ctx) => {
  const { issueId } = args as { issueId: string };

  try {
    const orchestrator = ctx.getOrchestrator();
    const result = await orchestrator.run(issueId as Id<"issues">);
    return ok(ctx, {
      session: { sessionId: result.sessionId, pid: result.pid },
    });
  } catch (err) {
    return error(String(err instanceof Error ? err.message : err));
  }
};

const orchestrator_kill: ToolHandler = async (_args, ctx) => {
  try {
    const orchestrator = ctx.getOrchestrator();
    await orchestrator.kill();
    return ok(ctx, { message: "Session killed." });
  } catch (err) {
    return error(String(err instanceof Error ? err.message : err));
  }
};

const orchestrator_status: ToolHandler = async (_args, ctx) => {
  const orchestrator = ctx.getOrchestrator();
  const status = orchestrator.getStatus();
  return ok(ctx, { status });
};

const sessions_list: ToolHandler = async (args, ctx) => {
  const { status } = args as {
    status?: "running" | "completed" | "failed";
  };

  const sessions = await ctx.convex.query(api.sessions.list, {
    projectId: ctx.projectId,
    status,
  });
  return ok(ctx, { sessions, count: sessions.length });
};

// ── Export all implemented handlers ───────────────────────────────────

export const handlers: Record<string, ToolHandler> = {
  issues_create,
  issues_list,
  issues_get,
  issues_update,
  orchestrator_run,
  orchestrator_kill,
  orchestrator_status,
  sessions_list,
};
