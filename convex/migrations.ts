/**
 * Idempotent data migrations for schema field promotions.
 *
 * Run before `bunx convex deploy` when promoting a field from optional to required.
 * Each migration is safe to re-run — it skips documents that already have the field.
 *
 * Usage:
 *   bunx convex run migrations:backfillPriorityOrder
 *
 * See CLAUDE.md "Schema Migrations" for the full workflow.
 */
import { internalMutation } from "./_generated/server";
import { toPriorityOrder } from "./issues";
import { IssuePriority, type IssuePriorityValue } from "./schema";

/**
 * Backfill `priorityOrder` on issues that are missing it.
 *
 * Added for FLUX-207 (made priorityOrder required). Safe to re-run:
 * skips any issue that already has a numeric priorityOrder.
 */
export const backfillPriorityOrder = internalMutation({
  handler: async (ctx) => {
    const allIssues = await ctx.db.query("issues").collect();

    let patched = 0;
    let skipped = 0;

    for (const issue of allIssues) {
      // Already has a valid priorityOrder — skip
      if (typeof issue.priorityOrder === "number") {
        skipped++;
        continue;
      }

      // Derive from priority field. If priority is also missing, default to medium.
      const priority =
        (issue.priority as IssuePriorityValue) ?? IssuePriority.Medium;

      await ctx.db.patch(issue._id, {
        priorityOrder: toPriorityOrder(priority),
      });
      patched++;
    }

    return { patched, skipped, total: allIssues.length };
  },
});
