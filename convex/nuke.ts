import type { TableNames } from "./_generated/dataModel";
import { internalMutation } from "./_generated/server";
import schema from "./schema";

export const all = internalMutation({
  handler: async (ctx) => {
    const tables = Object.keys(schema.tables) as TableNames[];

    let totalDeleted = 0;

    for (const tableName of tables) {
      const docs = await ctx.db.query(tableName).collect();
      for (const doc of docs) {
        await ctx.db.delete(doc._id);
        totalDeleted++;
      }
    }

    return { deletedTables: tables.length, totalDeleted };
  },
});
