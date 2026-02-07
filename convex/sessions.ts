import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  SessionStatus,
  sessionStatusValidator,
  sessionTypeValidator,
} from "./schema";

export const create = mutation({
  args: {
    projectId: v.id("projects"),
    issueId: v.id("issues"),
    type: sessionTypeValidator,
    agent: v.string(),
    pid: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error(`Project ${args.projectId} not found`);

    const issue = await ctx.db.get(args.issueId);
    if (!issue) throw new Error(`Issue ${args.issueId} not found`);

    const sessionId = await ctx.db.insert("sessions", {
      projectId: args.projectId,
      issueId: args.issueId,
      type: args.type,
      agent: args.agent,
      status: SessionStatus.Running,
      startedAt: Date.now(),
      pid: args.pid,
    });

    return await ctx.db.get(sessionId);
  },
});

export const update = mutation({
  args: {
    sessionId: v.id("sessions"),
    status: v.optional(sessionStatusValidator),
    endedAt: v.optional(v.number()),
    exitCode: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error(`Session ${args.sessionId} not found`);

    const updates: Record<string, unknown> = {};
    if (args.status !== undefined) updates.status = args.status;
    if (args.endedAt !== undefined) updates.endedAt = args.endedAt;
    if (args.exitCode !== undefined) updates.exitCode = args.exitCode;

    await ctx.db.patch(args.sessionId, updates);
    return await ctx.db.get(args.sessionId);
  },
});

export const list = query({
  args: {
    projectId: v.id("projects"),
    status: v.optional(sessionStatusValidator),
  },
  handler: async (ctx, args) => {
    let sessions = await ctx.db
      .query("sessions")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    if (args.status) {
      sessions = sessions.filter((s) => s.status === args.status);
    }

    sessions.sort((a, b) => b.startedAt - a.startedAt);

    return sessions;
  },
});

export const get = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.sessionId);
  },
});
