import { api } from "$convex/_generated/api";
import type { Id } from "$convex/_generated/dataModel";
import { IssueStatus, SessionStatus, SessionType } from "$convex/schema";
import { getConvexClient } from "../convex";
import { resolveRepoRoot } from "../git";
import type { AgentProcess, AgentProvider } from "./agents";
import { ClaudeCodeProvider } from "./agents";
import { SessionMonitor } from "./monitor";

/**
 * Orchestrator states — runtime state of the Flux daemon.
 * STOPPED: scheduler disabled, no auto-scheduling.
 * IDLE: scheduler enabled, waiting for work.
 * BUSY: active session in progress.
 */
const OrchestratorState = {
  Stopped: "stopped",
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
  monitor: SessionMonitor;
  monitorDone: Promise<void>;
  killed: boolean;
}

/** Orchestrator manages claiming issues, spawning agents, and session lifecycle. */
class Orchestrator {
  private state: OrchestratorState = OrchestratorState.Stopped;
  private activeSession: ActiveSession | null = null;
  private provider: AgentProvider;
  private projectId: Id<"projects">;
  private unsubscribeReady: (() => void) | null = null;
  private pendingStop = false;
  private readyIssues: Array<{ _id: Id<"issues"> }> = [];
  private maxFailures = 3;

  constructor(projectId: Id<"projects">, provider?: AgentProvider) {
    this.projectId = projectId;
    this.provider = provider ?? new ClaudeCodeProvider();
  }

  getStatus(): {
    state: OrchestratorState;
    schedulerEnabled: boolean;
    readyCount: number;
    activeSession: {
      sessionId: string;
      issueId: string;
      pid: number;
    } | null;
  } {
    return {
      state: this.state,
      schedulerEnabled: this.unsubscribeReady !== null,
      readyCount: this.readyIssues.length,
      activeSession: this.activeSession
        ? {
            sessionId: this.activeSession.sessionId,
            issueId: this.activeSession.issueId,
            pid: this.activeSession.process.pid,
          }
        : null,
    };
  }

  /** Get the active session's monitor (for reading live buffer). */
  getActiveMonitor(): SessionMonitor | null {
    return this.activeSession?.monitor ?? null;
  }

  /**
   * Enable the auto-scheduler: persist config, recover orphans, subscribe to ready issues.
   * Transitions from Stopped → Idle and begins watching for work.
   */
  async enable(): Promise<void> {
    if (this.state === OrchestratorState.Busy) {
      throw new Error(
        "Cannot enable scheduler while busy. Wait for current session to complete.",
      );
    }

    const convex = getConvexClient();

    // Persist to DB (upsert handled by the mutation)
    await convex.mutation(api.orchestratorConfig.enable, {
      projectId: this.projectId,
    });

    // Fetch config for maxFailures
    const config = await convex.query(api.orchestratorConfig.get, {
      projectId: this.projectId,
    });
    if (config) {
      this.maxFailures = config.maxFailures;
    }

    // Recover orphaned sessions before subscribing
    await this.recoverOrphanedSessions();

    // Subscribe to ready issues
    this.pendingStop = false;
    this.unsubscribeReady = convex.onUpdate(
      api.issues.ready,
      { projectId: this.projectId, maxFailures: this.maxFailures },
      (issues) => {
        this.readyIssues = issues;
        this.scheduleNext();
      },
    );

    this.state = OrchestratorState.Idle;
  }

  /**
   * Stop the auto-scheduler. Unsubscribes from ready issues and persists config.
   * If busy, sets pendingStop so the current session finishes before transitioning to Stopped.
   */
  async stop(): Promise<void> {
    // Unsubscribe first
    if (this.unsubscribeReady) {
      this.unsubscribeReady();
      this.unsubscribeReady = null;
    }
    this.readyIssues = [];

    const convex = getConvexClient();
    await convex.mutation(api.orchestratorConfig.disable, {
      projectId: this.projectId,
    });

    if (this.state === OrchestratorState.Busy) {
      // Let the current session finish, then transition to stopped
      this.pendingStop = true;
    } else {
      this.state = OrchestratorState.Stopped;
      this.pendingStop = false;
    }
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

    // 5. Start monitoring agent output
    const monitor = new SessionMonitor(session._id, this.projectId);
    const monitorDone = monitor.consume(agentProcess.stdout);

    // 6. Track active session
    this.state = OrchestratorState.Busy;
    this.activeSession = {
      sessionId: session._id,
      issueId,
      process: agentProcess,
      monitor,
      monitorDone,
      killed: false,
    };

    // 7. Fire-and-forget: handle agent exit in background
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

    // Wait for monitor to finish draining stdout before finalizing
    try {
      await this.activeSession.monitorDone;
    } catch (err) {
      console.error("[Orchestrator] Monitor drain error:", err);
    }
    await this.activeSession.monitor.shutdown();

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

    if (this.pendingStop || !this.unsubscribeReady) {
      this.state = OrchestratorState.Stopped;
      this.pendingStop = false;
    } else {
      this.state = OrchestratorState.Idle;
      this.scheduleNext();
    }
  }

  /**
   * Try to pick up the next ready issue. No-op if not idle or queue is empty.
   * Iterates through ready issues until one claim succeeds (others may be race-lost).
   */
  private scheduleNext(): void {
    if (this.state !== OrchestratorState.Idle) return;
    if (this.readyIssues.length === 0) return;

    // Try each ready issue until one claim succeeds (others may race)
    const issues = [...this.readyIssues];
    const tryNext = async () => {
      for (const issue of issues) {
        try {
          await this.run(issue._id);
          return; // Successfully started
        } catch {}
      }
    };
    tryNext();
  }

  /**
   * Recover orphaned sessions — running sessions whose PID is no longer alive.
   * Marks them as failed and reopens their issues for retry.
   */
  private async recoverOrphanedSessions(): Promise<void> {
    const convex = getConvexClient();
    const sessions = await convex.query(api.sessions.list, {
      projectId: this.projectId,
      status: SessionStatus.Running,
    });

    for (const session of sessions) {
      const pid = session.pid;
      let alive = false;

      if (pid) {
        try {
          process.kill(pid, 0);
          alive = true;
        } catch {
          alive = false;
        }
      }

      if (!alive) {
        await convex.mutation(api.sessions.update, {
          sessionId: session._id,
          status: SessionStatus.Failed,
          endedAt: Date.now(),
          exitCode: -1,
        });
        await convex.mutation(api.issues.update, {
          issueId: session.issueId,
          status: IssueStatus.Open,
        });
      }
    }
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
