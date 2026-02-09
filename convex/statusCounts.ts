/**
 * Status counter helpers for O(1) issue/session counting.
 *
 * Instead of .collect()-ing all documents per status bucket just to count them,
 * we maintain a `statusCounts` table with one row per (project, entity, status).
 * Mutations that change status call `adjustStatusCount` to keep counters in sync.
 *
 * Counter reads replace the old countIssuesByStatus / countSessionsByStatus
 * full-index scans with single document reads.
 *
 * FLUX-357
 */
import type { Id } from "./_generated/dataModel";
import type { DatabaseReader, MutationCtx } from "./_generated/server";
import type { CounterEntityValue } from "./schema";

/**
 * Increment or decrement a status counter by `delta`.
 *
 * Upserts: if the counter row doesn't exist yet, creates it with `delta` as
 * the initial count (clamped to 0). Negative counts are clamped to 0 to
 * prevent underflow from backfill races or duplicate decrements.
 */
export async function adjustStatusCount(
  ctx: MutationCtx,
  projectId: Id<"projects">,
  entity: CounterEntityValue,
  status: string,
  delta: number,
): Promise<void> {
  const existing = await ctx.db
    .query("statusCounts")
    .withIndex("by_project_entity_status", (q) =>
      q.eq("projectId", projectId).eq("entity", entity).eq("status", status),
    )
    .unique();

  if (existing) {
    const newCount = Math.max(0, existing.count + delta);
    await ctx.db.patch(existing._id, { count: newCount });
  } else {
    await ctx.db.insert("statusCounts", {
      projectId,
      entity,
      status,
      count: Math.max(0, delta),
    });
  }
}

/**
 * Transition a status counter: decrement the old status and increment the new.
 * Skips if oldStatus === newStatus (no-op transition).
 */
export async function transitionStatusCount(
  ctx: MutationCtx,
  projectId: Id<"projects">,
  entity: CounterEntityValue,
  oldStatus: string,
  newStatus: string,
): Promise<void> {
  if (oldStatus === newStatus) return;
  await adjustStatusCount(ctx, projectId, entity, oldStatus, -1);
  await adjustStatusCount(ctx, projectId, entity, newStatus, +1);
}

/**
 * Read status counts for a project/entity, returning a Record<string, number>.
 * When `statuses` is provided, only those buckets are read.
 */
export async function readStatusCounts(
  db: DatabaseReader,
  projectId: Id<"projects">,
  entity: CounterEntityValue,
  statuses?: string[],
): Promise<Record<string, number>> {
  if (statuses) {
    // Read only requested buckets — one indexed read each.
    const entries = await Promise.all(
      statuses.map(async (status) => {
        const row = await db
          .query("statusCounts")
          .withIndex("by_project_entity_status", (q) =>
            q
              .eq("projectId", projectId)
              .eq("entity", entity)
              .eq("status", status),
          )
          .unique();
        return [status, row?.count ?? 0] as const;
      }),
    );
    return Object.fromEntries(entries);
  }

  // No filter — read all counters for this project/entity.
  const rows = await db
    .query("statusCounts")
    .withIndex("by_project_entity_status", (q) =>
      q.eq("projectId", projectId).eq("entity", entity),
    )
    .collect();
  return Object.fromEntries(rows.map((r) => [r.status, r.count]));
}
