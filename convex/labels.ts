import { v } from "convex/values";
import { query } from "./_generated/server";

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
