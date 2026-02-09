import { api } from "$convex/_generated/api";
import type { Id } from "$convex/_generated/dataModel";
import { getConvexClient } from "./convex";
import { resolveRepoRoot, validateProjectPath } from "./git";

/** Loaded project data passed through the server startup pipeline. */
export type Project = {
  _id: Id<"projects">;
  slug: string;
  name: string;
  path: string;
};

/**
 * Load all registered projects from Convex.
 *
 * Returns an empty array when no projects exist — the frontend redirects
 * to /projects where the user can add their first project.
 */
export async function loadProjects(): Promise<Project[]> {
  const client = getConvexClient();
  const allProjects = await client.query(api.projects.list, {});

  if (allProjects.length > 0) {
    const projects = allProjects.map((p) => ({
      _id: p._id,
      slug: p.slug,
      name: p.name,
      path: p.path ?? "",
    }));

    // Auto-backfill: single-project setups with empty path get CWD resolved.
    // Multi-project setups warn instead — ambiguous which path to assign.
    const onlyProject = projects.length === 1 ? projects[0] : undefined;
    if (onlyProject && !onlyProject.path) {
      try {
        const repoRoot = await resolveRepoRoot();
        const validation = await validateProjectPath(repoRoot);
        if (validation.ok) {
          await client.mutation(api.projects.update, {
            projectId: onlyProject._id,
            path: repoRoot,
          });
          onlyProject.path = repoRoot;
          console.log(
            `[setup] Auto-detected path for "${onlyProject.slug}": ${repoRoot}`,
          );
        } else {
          console.warn(
            `[setup] CWD repo root "${repoRoot}" failed validation: ${validation.error}`,
          );
        }
      } catch (err) {
        console.warn(
          `[setup] Could not auto-detect path for "${onlyProject.slug}": ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    } else {
      for (const p of projects) {
        if (!p.path) {
          console.warn(
            `[setup] Project "${p.slug}" has no path configured — ` +
              "agent spawning will fail until a path is set via PATCH /api/projects/:id",
          );
        }
      }
    }

    console.log(
      `Loaded ${projects.length} project(s): ${projects.map((p) => p.slug).join(", ")}`,
    );
    return projects;
  }

  // Zero projects — return empty; the /projects page is the entry point
  // for adding the first project through the UI.
  console.log("[setup] No projects registered. Visit /projects to add one.");
  return [];
}
