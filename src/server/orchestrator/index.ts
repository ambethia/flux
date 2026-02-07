import { api } from "$convex/_generated/api";
import type { Id } from "$convex/_generated/dataModel";
import { IssueStatus, SessionStatus, SessionType } from "$convex/schema";
import { getConvexClient } from "../convex";
import { resolveRepoRoot } from "../git";
import type { AgentProcess, AgentProvider } from "./agents";
import { ClaudeCodeProvider } from "./agents";

/**
 * Orchestrator states — runtime state of the Flux daemon.
 * IDLE: not processing work. BUSY: active session in progress.
 */
const OrchestratorState = {
  Idle: "idle",
  Busy: "busy",
} as const;
type OrchestratorState =
  (typeof OrchestratorState)[keyof typeof OrchestratorState];

/** Runtime info about the currently active session. */
interface ActiveSession {
  sessionId: Id<"sessions">;
  issueId: Id<"issues">;
  process: AgentProcess;
  killed: boolean;
}

/** Orchestrator manages claiming issues, spawning agents, and session lifecycle. */
class Orchestrator {
  private state: OrchestratorState = OrchestratorState.Idle;
  private activeSession: ActiveSession | null = null;
  private provider: AgentProvider;
  private projectId: Id<"projects">;

  constructor(projectId: Id<"projects">, provider?: AgentProvider) {
    this.projectId = projectId;
    this.provider = provider ?? new ClaudeCodeProvider();
  }

  getStatus(): {
    state: OrchestratorState;
    activeSession: {
      sessionId: string;
      issueId: string;
      pid: number;
    } | null;
  } {
    return {
      state: this.state,
      activeSession: this.activeSession
        ? {
            sessionId: this.activeSession.sessionId,
            issueId: this.activeSession.issueId,
            pid: this.activeSession.process.pid,
          }
        : null,
    };
  }

  /**
   * Run a single issue: claim → spawn agent → return immediately.
   * Agent exit is handled in the background via fire-and-forget.
   * Throws if orchestrator is already busy or claim fails.
   */
  async run(
    issueId: Id<"issues">,
  ): Promise<{ sessionId: Id<"sessions">; pid: number }> {
    if (this.state === OrchestratorState.Busy) {
      throw new Error("Orchestrator is busy. Kill the current session first.");
    }

    const convex = getConvexClient();

    // 1. Claim the issue atomically
    const claimResult = await convex.mutation(api.issues.claim, {
      issueId,
      assignee: this.provider.name,
    });

    if (!claimResult.success) {
      throw new Error(`Failed to claim issue: ${claimResult.reason}`);
    }
    const issue = claimResult.issue;

    // 2. Resolve repo root for cwd
    const cwd = await resolveRepoRoot();

    // 3. Build prompt and spawn agent
    const prompt = this.provider.buildWorkPrompt({
      shortId: issue.shortId,
      title: issue.title,
      description: issue.description,
    });
    const agentProcess = this.provider.spawn({ cwd, prompt });

    // 4. Create session record
    const session = await convex.mutation(api.sessions.create, {
      projectId: this.projectId,
      issueId,
      type: SessionType.Work,
      agent: this.provider.name,
      pid: agentProcess.pid,
    });
    if (!session) {
      agentProcess.kill();
      throw new Error("Failed to create session record");
    }

    // 5. Track active session
    this.state = OrchestratorState.Busy;
    this.activeSession = {
      sessionId: session._id,
      issueId,
      process: agentProcess,
      killed: false,
    };

    // 6. Fire-and-forget: handle agent exit in background
    agentProcess.wait().then(
      ({ exitCode }) => this.handleExit(exitCode),
      () => this.handleExit(1),
    );

    return { sessionId: session._id, pid: agentProcess.pid };
  }

  /**
   * Kill the running agent immediately.
   * The exit handler will detect the `killed` flag and apply hand-off semantics:
   * issue stays in_progress, session marked as failed.
   */
  async kill(): Promise<void> {
    if (this.state !== OrchestratorState.Busy || !this.activeSession) {
      throw new Error("No active session to kill.");
    }

    // Mark as killed so the exit handler knows this was intentional
    this.activeSession.killed = true;
    this.activeSession.process.kill();

    // Exit handler (handleExit) will run when the process actually terminates
    // and will apply kill-specific finalization (hand-off semantics).
  }

  /**
   * Handle agent process exit. Called from the fire-and-forget .then() chain.
   * Determines outcome based on exit code and whether kill() was called.
   */
  private async handleExit(exitCode: number): Promise<void> {
    if (!this.activeSession) return;

    const { sessionId, issueId, killed } = this.activeSession;
    const convex = getConvexClient();

    if (killed) {
      // Kill path: session failed, issue stays in_progress (hand-off to human)
      await convex.mutation(api.sessions.update, {
        sessionId,
        status: SessionStatus.Failed,
        endedAt: Date.now(),
        exitCode,
      });
    } else {
      // Natural exit: finalize based on exit code
      const succeeded = exitCode === 0;

      await convex.mutation(api.sessions.update, {
        sessionId,
        status: succeeded ? SessionStatus.Completed : SessionStatus.Failed,
        endedAt: Date.now(),
        exitCode,
      });

      // Success → close issue. Failure → reopen for retry.
      await convex.mutation(api.issues.update, {
        issueId,
        status: succeeded ? IssueStatus.Closed : IssueStatus.Open,
      });
    }

    this.activeSession = null;
    this.state = OrchestratorState.Idle;
  }
}

// Module-level singleton — initialized once per server lifetime
let _orchestrator: Orchestrator | undefined;

export function getOrchestrator(projectId: Id<"projects">): Orchestrator {
  if (!_orchestrator) {
    _orchestrator = new Orchestrator(projectId);
  }
  return _orchestrator;
}

export { Orchestrator, OrchestratorState };
