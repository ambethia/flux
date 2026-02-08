import { api } from "$convex/_generated/api";
import type { Id } from "$convex/_generated/dataModel";
import { ProjectState, type ProjectStateValue } from "$convex/schema";
import { getConvexClient } from "./convex";
import {
  getOrchestrator,
  OrchestratorState,
  type OrphanRecoveryStats,
} from "./orchestrator";

/**
 * FLUX-280: On daemon startup, eagerly recover all projects in `running` state.
 *
 * For each running project: creates an orchestrator, calls enable() (which
 * triggers orphan recovery), and logs a summary of what was found.
 *
 * Returns a Map of project states suitable for seeding the project state watcher,
 * preventing redundant transitions on the first subscription callback.
 */
export async function recoverRunningProjects(): Promise<
  Map<Id<"projects">, ProjectStateValue>
> {
  const convex = getConvexClient();
  const allProjects = await convex.query(api.projects.list, {});

  // Build initial state map for all projects (seeds the watcher)
  const initialStates = new Map<Id<"projects">, ProjectStateValue>();
  for (const p of allProjects) {
    if (p.state) {
      initialStates.set(p._id, p.state);
    }
  }

  const runningProjects = allProjects.filter(
    (p) => p.state === ProjectState.Running && p.path,
  );

  if (runningProjects.length === 0) {
    console.log("[StartupRecovery] No projects in running state — skipping");
    return initialStates;
  }

  console.log(
    `[StartupRecovery] Found ${runningProjects.length} project(s) in running state: ${runningProjects.map((p) => p.slug).join(", ")}`,
  );

  for (const project of runningProjects) {
    const projectPath = project.path;
    if (!projectPath) continue; // Already filtered, but satisfies TS

    try {
      const orch = getOrchestrator(project._id, projectPath);
      const { state } = orch.getStatus();

      // Already enabled (e.g., survived a hot reload) — skip
      if (
        state === OrchestratorState.Idle ||
        state === OrchestratorState.Busy
      ) {
        console.log(
          `[StartupRecovery] ${project.slug}: already ${state}, skipping`,
        );
        continue;
      }

      const stats = await orch.enable();
      logRecoveryStats(project.slug, stats);
    } catch (err) {
      console.error(
        `[StartupRecovery] Failed to recover project "${project.slug}" (${project._id}):`,
        err,
      );
      // Reset to stopped so UI reflects reality — same pattern as projectStateWatcher
      try {
        await convex.mutation(api.projects.update, {
          projectId: project._id,
          state: ProjectState.Stopped,
        });
        initialStates.set(project._id, ProjectState.Stopped);
      } catch (resetErr) {
        console.error(
          `[StartupRecovery] CRITICAL: Failed to reset project "${project.slug}" to stopped`,
          resetErr,
        );
      }
    }
  }

  return initialStates;
}

function logRecoveryStats(slug: string, stats: OrphanRecoveryStats): void {
  const parts: string[] = [];
  if (stats.deadSessions > 0) {
    parts.push(`${stats.deadSessions} dead session(s) marked failed`);
  }
  if (stats.adoptedSessions > 0) {
    parts.push(`${stats.adoptedSessions} live session(s) re-adopted`);
  }
  if (stats.orphanedIssues > 0) {
    parts.push(`${stats.orphanedIssues} orphaned issue(s) reopened`);
  }

  if (parts.length === 0) {
    console.log(`[StartupRecovery] ${slug}: enabled (no orphans found)`);
  } else {
    console.log(
      `[StartupRecovery] ${slug}: enabled — recovered ${parts.join(", ")}`,
    );
  }
}
