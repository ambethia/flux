import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const countByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const labels = await ctx.db
      .query("labels")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
    return labels.length;
  },
});

export const list = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    return await ctx.db
      .query("labels")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
  },
});

export const create = mutation({
  args: {
    projectId: v.id("projects"),
    name: v.string(),
    color: v.string(),
  },
  handler: async (ctx, { projectId, name, color }) => {
    const existing = await ctx.db
      .query("labels")
      .withIndex("by_project_name", (q) =>
        q.eq("projectId", projectId).eq("name", name),
      )
      .first();
    if (existing) throw new Error(`Label "${name}" already exists`);

    return await ctx.db.insert("labels", { projectId, name, color });
  },
});

export const update = mutation({
  args: {
    labelId: v.id("labels"),
    name: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, { labelId, name, color }) => {
    const label = await ctx.db.get(labelId);
    if (!label) throw new Error(`Label ${labelId} not found`);

    if (name !== undefined && name !== label.name) {
      const duplicate = await ctx.db
        .query("labels")
        .withIndex("by_project_name", (q) =>
          q.eq("projectId", label.projectId).eq("name", name),
        )
        .first();
      if (duplicate) throw new Error(`Label "${name}" already exists`);
    }

    const updates: Record<string, string> = {};
    if (name !== undefined) updates.name = name;
    if (color !== undefined) updates.color = color;

    await ctx.db.patch(labelId, updates);
    return await ctx.db.get(labelId);
  },
});

export const remove = mutation({
  args: { labelId: v.id("labels") },
  handler: async (ctx, { labelId }) => {
    const label = await ctx.db.get(labelId);
    if (!label) throw new Error(`Label ${labelId} not found`);

    // Clean up stale labelIds from all issues in this project
    const issues = await ctx.db
      .query("issues")
      .withIndex("by_project_deletedAt_status", (q) =>
        q.eq("projectId", label.projectId),
      )
      .collect();
    for (const issue of issues) {
      if (!issue.labelIds?.includes(labelId)) continue;
      await ctx.db.patch(issue._id, {
        labelIds: issue.labelIds.filter((id) => id !== labelId),
      });
    }

    await ctx.db.delete(labelId);
  },
});
