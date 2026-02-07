import { query } from "./_generated/server";

export const count = query({
  handler: async (ctx) => {
    const costs = await ctx.db.query("llmCosts").collect();
    return costs.length;
  },
});
