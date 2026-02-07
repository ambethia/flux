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
    }
    return { success: true };
  },
});
