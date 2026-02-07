import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const IssueStatus = {
  Open: "open",
  InProgress: "in_progress",
  Closed: "closed",
} as const;

export const IssuePriority = {
  Critical: "critical",
  High: "high",
  Medium: "medium",
  Low: "low",
} as const;

export const SessionStatus = {
  Running: "running",
  Completed: "completed",
  Failed: "failed",
} as const;

export const sessionStatusValidator = v.union(
  v.literal(SessionStatus.Running),
  v.literal(SessionStatus.Completed),
  v.literal(SessionStatus.Failed),
);

export const SessionType = {
  Work: "work",
} as const;

export const sessionTypeValidator = v.union(v.literal(SessionType.Work));

export const SessionEventDirection = {
  Input: "input",
  Output: "output",
} as const;

export const sessionEventDirectionValidator = v.union(
  v.literal(SessionEventDirection.Input),
  v.literal(SessionEventDirection.Output),
);

export const issueStatusValidator = v.union(
  v.literal(IssueStatus.Open),
  v.literal(IssueStatus.InProgress),
  v.literal(IssueStatus.Closed),
);

export const issuePriorityValidator = v.union(
  v.literal(IssuePriority.Critical),
  v.literal(IssuePriority.High),
  v.literal(IssuePriority.Medium),
  v.literal(IssuePriority.Low),
);

export default defineSchema({
  projects: defineTable({
    slug: v.string(),
    name: v.string(),
    issueCounter: v.number(),
  }).index("by_slug", ["slug"]),

  issues: defineTable({
    projectId: v.id("projects"),
    shortId: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    status: issueStatusValidator,
    priority: issuePriorityValidator,
    assignee: v.optional(v.string()),
    failureCount: v.number(),
    closedAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  }).index("by_project", ["projectId"]),

  labels: defineTable({
    projectId: v.id("projects"),
    name: v.string(),
    color: v.string(),
  })
    .index("by_project", ["projectId"])
    .index("by_project_name", ["projectId", "name"]),

  llmCosts: defineTable({
    model: v.string(),
    inputTokenCost: v.number(),
    outputTokenCost: v.number(),
  }).index("by_model", ["model"]),

  sessions: defineTable({
    projectId: v.id("projects"),
    issueId: v.id("issues"),
    type: sessionTypeValidator,
    agent: v.string(),
    status: sessionStatusValidator,
    startedAt: v.number(),
    endedAt: v.optional(v.number()),
    exitCode: v.optional(v.number()),
    pid: v.optional(v.number()),
    lastHeartbeat: v.optional(v.number()),
  })
    .index("by_project", ["projectId"])
    .index("by_issue", ["issueId"]),

  sessionEvents: defineTable({
    sessionId: v.id("sessions"),
    sequence: v.number(),
    direction: sessionEventDirectionValidator,
    content: v.string(),
    timestamp: v.number(),
  }).index("by_session", ["sessionId"]),

  orchestratorConfig: defineTable({
    projectId: v.id("projects"),
    enabled: v.boolean(),
    agent: v.string(),
    focusEpicId: v.optional(v.id("epics")),
    sessionTimeoutMs: v.number(),
    maxFailures: v.number(),
    maxReviewIterations: v.number(),
  }).index("by_project", ["projectId"]),
});
