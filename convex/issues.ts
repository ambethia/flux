import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  IssuePriority,
  IssueStatus,
  issuePriorityValidator,
  issueStatusValidator,
} from "./schema";

const PRIORITY_ORDER = {
  [IssuePriority.Critical]: 0,
  [IssuePriority.High]: 1,
  [IssuePriority.Medium]: 2,
  [IssuePriority.Low]: 3,
} as const;

function generateShortId(slug: string, counter: number): string {
  return `${slug.toUpperCase()}-${counter}`;
}

export const create = mutation({
  args: {
    projectId: v.id("projects"),
    title: v.string(),
    description: v.optional(v.string()),
    priority: v.optional(issuePriorityValidator),
  },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error(`Project ${args.projectId} not found`);

    const counter = project.issueCounter + 1;
    await ctx.db.patch(args.projectId, { issueCounter: counter });

    const issueId = await ctx.db.insert("issues", {
      projectId: args.projectId,
      shortId: generateShortId(project.slug, counter),
      title: args.title,
      description: args.description,
      status: IssueStatus.Open,
      priority: args.priority ?? IssuePriority.Medium,
      assignee: undefined,
      failureCount: 0,
      updatedAt: Date.now(),
    });

    return issueId;
  },
});

export const list = query({
  args: {
    projectId: v.id("projects"),
    status: v.optional(issueStatusValidator),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let issues = await ctx.db
      .query("issues")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .take(args.limit || 100);

    if (args.status) issues = issues.filter((i) => i.status === args.status);

    issues.sort((a, b) => {
      const diff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      return diff !== 0
        ? diff
        : (a._creationTime || 0) - (b._creationTime || 0);
    });

    return issues;
  },
});

export const ready = query({
  args: {
    projectId: v.id("projects"),
    maxFailures: v.number(),
  },
  handler: async (ctx, { projectId, maxFailures }) => {
    const issues = await ctx.db
      .query("issues")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();

    return issues
      .filter(
        (i) => i.status === IssueStatus.Open && i.failureCount < maxFailures,
      )
      .sort((a, b) => {
        const diff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
        return diff !== 0 ? diff : a._creationTime - b._creationTime;
      });
  },
});

export const get = query({
  args: { issueId: v.id("issues") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.issueId);
  },
});

export const claim = mutation({
  args: {
    issueId: v.id("issues"),
    assignee: v.string(),
  },
  handler: async (ctx, { issueId, assignee }) => {
    const issue = await ctx.db.get(issueId);
    if (!issue) throw new Error(`Issue ${issueId} not found`);
    if (issue.status !== IssueStatus.Open) {
      return { success: false as const, reason: "not_open" };
    }
    await ctx.db.patch(issueId, {
      status: IssueStatus.InProgress,
      assignee,
      updatedAt: Date.now(),
    });
    const updated = await ctx.db.get(issueId);
    return { success: true as const, issue: updated! };
  },
});

export const update = mutation({
  args: {
    issueId: v.id("issues"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(issueStatusValidator),
    priority: v.optional(issuePriorityValidator),
    assignee: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const issue = await ctx.db.get(args.issueId);
    if (!issue) throw new Error(`Issue ${args.issueId} not found`);

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.title !== undefined) updates.title = args.title;
    if (args.description !== undefined) updates.description = args.description;
    if (args.status !== undefined) updates.status = args.status;
    if (args.priority !== undefined) updates.priority = args.priority;
    if (args.assignee !== undefined) updates.assignee = args.assignee;

    await ctx.db.patch(args.issueId, updates);
    return await ctx.db.get(args.issueId);
  },
});
