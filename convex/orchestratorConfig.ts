import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const exists = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const config = await ctx.db
      .query("orchestratorConfig")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .first();
    return config !== null;
  },
});

export const get = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    return await ctx.db
      .query("orchestratorConfig")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .first();
  },
});

export const enable = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const config = await ctx.db
      .query("orchestratorConfig")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .first();
    if (config) {
      await ctx.db.patch(config._id, { enabled: true });
    } else {
      await ctx.db.insert("orchestratorConfig", {
        projectId,
        enabled: true,
        agent: "claude",
        sessionTimeoutMs: 30 * 60 * 1000,
        maxFailures: 3,
        maxReviewIterations: 10,
      });
    }
    return { success: true };
  },
});

export const update = mutation({
  args: {
    projectId: v.id("projects"),
    maxReviewIterations: v.optional(v.number()),
    maxFailures: v.optional(v.number()),
    sessionTimeoutMs: v.optional(v.number()),
  },
  handler: async (ctx, { projectId, ...patch }) => {
    const config = await ctx.db
      .query("orchestratorConfig")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .first();
    if (!config) {
      throw new Error(`No orchestrator config found for project ${projectId}`);
    }
    // Strip undefined values
    const updates: Record<string, number> = {};
    for (const [k, val] of Object.entries(patch)) {
      if (val !== undefined) updates[k] = val;
    }
    await ctx.db.patch(config._id, updates);
    return { success: true };
  },
});

export const disable = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const config = await ctx.db
      .query("orchestratorConfig")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .first();
    if (!config) {
      throw new Error(`No orchestrator config found for project ${projectId}`);
    }
    await ctx.db.patch(config._id, { enabled: false });
    return { success: true };
  },
});
