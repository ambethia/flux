/**
 * Review outcome stacking integration test (FLUX-371)
 *
 * Verifies that review prompts include issues created in previous review sessions,
 * enabling agents to avoid creating duplicate follow-up issues across iterations.
 *
 * Flow:
 * 1. Create a test project and issue
 * 2. Simulate a work session that completes successfully
 * 3. Simulate review session #1 that creates follow-up issues
 * 4. Simulate review session #2 and verify its prompt includes issues from #1
 *
 * Uses a MockAgentProvider that:
 * - Returns disposition JSON on stdout
 * - Simulates creating issues via MCP (mocked in this test)
 *
 * Requires: CONVEX_URL env var pointing to a running Convex deployment.
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ConvexClient } from "convex/browser";
import { api } from "$convex/_generated/api";
import type { Id } from "$convex/_generated/dataModel";
import { SessionStatus, SessionType } from "$convex/schema";
import { buildReviewPrompt } from "./agents/prompts";

describe("Review outcome stacking (FLUX-371)", () => {
  let convex: ConvexClient;
  let projectId: Id<"projects">;
  let issueId: Id<"issues">;
  let tmpDir: string;

  beforeAll(async () => {
    const url = process.env.CONVEX_URL;
    if (!url) throw new Error("CONVEX_URL not set");

    convex = new ConvexClient(url);

    // Create temp git repo
    tmpDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "flux-test-review-stacking-"),
    );
    await Bun.$`git init ${tmpDir}`.quiet();
    await Bun.$`git -C ${tmpDir} config user.email "test@flux.dev"`.quiet();
    await Bun.$`git -C ${tmpDir} config user.name "Flux Test"`.quiet();
    await fs.writeFile(path.join(tmpDir, "README.md"), "# Test Project\n");
    await Bun.$`git -C ${tmpDir} add -A && git -C ${tmpDir} commit -m "Initial commit"`.quiet();

    // Create test project (enabled: false so daemon ignores it)
    projectId = await convex.mutation(api.projects.create, {
      slug: `test-review-stack-${Date.now()}`,
      name: "Review Stacking Test",
      path: tmpDir,
      enabled: false,
    });

    // Create test issue
    issueId = await convex.mutation(api.issues.create, {
      projectId,
      title: "Test multi-iteration review",
      description:
        "Simulate multiple review iterations to test outcome stacking",
    });
  });

  afterAll(async () => {
    if (projectId) {
      await convex.mutation(api.projects.remove, { projectId });
    }
    if (tmpDir) {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
    await convex.close();
  });

  test("review prompt includes issues created in previous review sessions", async () => {
    // 1. Create a work session (completed)
    const workStartHead = await Bun.$`git -C ${tmpDir} rev-parse HEAD`.text();
    const workSession = await convex.mutation(api.sessions.create, {
      projectId,
      issueId,
      type: SessionType.Work,
      agent: "test-agent",
      pid: 12345,
      startHead: workStartHead.trim(),
    });
    if (!workSession) throw new Error("Failed to create work session");
    const workSessionId = workSession._id;

    // Simulate work: create a commit
    await fs.writeFile(
      path.join(tmpDir, "feature.ts"),
      "export const foo = 42;\n",
    );
    await Bun.$`git -C ${tmpDir} add -A && git -C ${tmpDir} commit -m "FLUX-TEST: Add feature"`.quiet();
    const workEndHead = await Bun.$`git -C ${tmpDir} rev-parse HEAD`.text();

    // Complete work session
    await convex.mutation(api.sessions.update, {
      sessionId: workSessionId,
      status: SessionStatus.Completed,
      endedAt: Date.now(),
      exitCode: 0,
      disposition: "done",
      note: "Implemented feature",
      endHead: workEndHead.trim(),
    });

    // 2. Create first review session
    const review1Session = await convex.mutation(api.sessions.create, {
      projectId,
      issueId,
      type: SessionType.Review,
      agent: "test-agent",
      pid: 12346,
      startHead: workStartHead.trim(),
    });
    if (!review1Session) throw new Error("Failed to create review session 1");
    const review1SessionId = review1Session._id;

    // Simulate review 1 creating follow-up issues
    await convex.mutation(api.issues.create, {
      projectId,
      title: "Add error handling",
      description: "Missing try-catch around async calls",
      sourceIssueId: issueId,
      createdInSessionId: review1SessionId,
      createdByAgent: "test-agent",
    });

    await convex.mutation(api.issues.create, {
      projectId,
      title: "Add input validation",
      description: "Function accepts any input without validation",
      sourceIssueId: issueId,
      createdInSessionId: review1SessionId,
      createdByAgent: "test-agent",
    });

    // Complete review 1 with inline fixes
    await fs.writeFile(
      path.join(tmpDir, "feature.ts"),
      "export const foo = 42; // Fixed\n",
    );
    await Bun.$`git -C ${tmpDir} add -A && git -C ${tmpDir} commit -m "Review 1: Fix inline issues"`.quiet();
    const review1EndHead = await Bun.$`git -C ${tmpDir} rev-parse HEAD`.text();

    await convex.mutation(api.sessions.update, {
      sessionId: review1SessionId,
      status: SessionStatus.Completed,
      endedAt: Date.now(),
      exitCode: 0,
      disposition: "done",
      note: "Found 2 issues: missing error handling, no validation. Fixed inline styling.",
      endHead: review1EndHead.trim(),
    });

    // Increment review iterations
    await convex.mutation(api.issues.incrementReviewIterations, {
      issueId,
    });

    // 3. Create second review session
    const review2Session = await convex.mutation(api.sessions.create, {
      projectId,
      issueId,
      type: SessionType.Review,
      agent: "test-agent",
      pid: 12347,
      startHead: workStartHead.trim(),
    });
    if (!review2Session) throw new Error("Failed to create review session 2");

    // 4. Query previous review sessions (simulating orchestrator's startReviewLoop)
    const previousReviewSessions = await convex.query(
      api.sessions.listByIssue,
      {
        issueId,
        type: SessionType.Review,
        status: SessionStatus.Completed,
      },
    );

    expect(previousReviewSessions.length).toBe(1);
    const prevSession = previousReviewSessions[0];
    expect(prevSession).toBeDefined();

    // 5. Fetch issues created during previous review
    const createdIssues = await convex.query(api.issues.listBySession, {
      sessionId: prevSession!._id,
    });

    expect(createdIssues.length).toBe(2);
    expect(createdIssues.map((i) => i.title)).toEqual([
      "Add error handling",
      "Add input validation",
    ]);

    // 6. Build previousReviews context (as orchestrator does)
    const previousReviews = [
      {
        iteration: 1,
        disposition: prevSession!.disposition ?? "unknown",
        note: prevSession!.note ?? "No note provided",
        createdIssues: createdIssues.map((i) => ({
          shortId: i.shortId,
          title: i.title,
        })),
        commitLog: "abc123 Review 1: Fix inline issues",
      },
    ];

    // 7. Build review prompt and verify it includes previousReviews
    const issue = await convex.query(api.issues.get, { issueId });
    if (!issue) throw new Error("Issue not found");

    const reviewPrompt = buildReviewPrompt({
      shortId: issue.shortId,
      title: issue.title,
      description: issue.description,
      diff: "diff content",
      commitLog: "commit log",
      relatedIssues: [],
      reviewIteration: 2,
      maxReviewIterations: 10,
      previousReviews,
    });

    // 8. Assert prompt contains previous review context
    expect(reviewPrompt).toContain("## Previous Review Iterations");
    expect(reviewPrompt).toContain("### Review 1");
    expect(reviewPrompt).toContain("- Disposition: done");
    expect(reviewPrompt).toContain(
      '- Note: "Found 2 issues: missing error handling, no validation. Fixed inline styling."',
    );
    expect(reviewPrompt).toContain("- Created issues:");
    expect(reviewPrompt).toContain("Add error handling");
    expect(reviewPrompt).toContain("Add input validation");
    expect(reviewPrompt).toContain(
      "DO NOT re-create issues that were already filed",
    );
  });
});
