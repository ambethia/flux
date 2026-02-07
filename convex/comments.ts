import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const authorValidator = v.union(
  v.literal("user"),
  v.literal("agent"),
  v.literal("flux"),
);

export const create = mutation({
  args: {
    issueId: v.id("issues"),
    content: v.string(),
    author: v.optional(authorValidator),
  },
  handler: async (ctx, args) => {
    const issue = await ctx.db.get(args.issueId);
    if (!issue) throw new Error(`Issue ${args.issueId} not found`);

    const commentId = await ctx.db.insert("comments", {
      issueId: args.issueId,
      content: args.content,
      author: args.author ?? "agent",
      createdAt: Date.now(),
    });

    return commentId;
  },
});

export const list = query({
  args: {
    issueId: v.id("issues"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const cap = Math.min(args.limit ?? 50, 200);

    return await ctx.db
      .query("comments")
      .withIndex("by_issue", (q) => q.eq("issueId", args.issueId))
      .take(cap);
  },
});
