import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { TableNames } from "./_generated/dataModel";
import { internalAction, internalMutation } from "./_generated/server";
import schema from "./schema";

/**
 * Maximum documents to delete per batch mutation.
 * Each doc requires a read + delete = 2 operations. 500 deletes ≈ 1000 ops,
 * well under the ~8192 limit even accounting for index queries.
 */
const NUKE_BATCH_SIZE = 500;

/**
 * Nuke all data across every table in the schema.
 *
 * Uses an action that loops through each table, calling a batch mutation
 * per chunk to stay well under Convex's ~8192 document operation limit.
 */
export const all = internalAction({
  handler: async (ctx) => {
    const tables = Object.keys(schema.tables) as TableNames[];

    let totalDeleted = 0;
    for (const tableName of tables) {
      let hasMore = true;
      while (hasMore) {
        const result = await ctx.runMutation(internal.nuke.nukeBatch, {
          tableName,
          batchSize: NUKE_BATCH_SIZE,
        });
        totalDeleted += result.deleted;
        hasMore = result.deleted >= NUKE_BATCH_SIZE;
      }
    }

    return { deletedTables: tables.length, totalDeleted };
  },
});

/**
 * Delete up to `batchSize` documents from a single table.
 * Returns the count deleted so the action knows whether to loop.
 */
export const nukeBatch = internalMutation({
  args: {
    tableName: v.string(),
    batchSize: v.number(),
  },
  handler: async (ctx, { tableName, batchSize }) => {
    const docs = await ctx.db.query(tableName as TableNames).take(batchSize);

    for (const doc of docs) {
      await ctx.db.delete(doc._id);
    }

    return { deleted: docs.length };
  },
});
