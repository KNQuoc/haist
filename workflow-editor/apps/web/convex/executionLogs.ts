import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const list = query({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const q = ctx.db
      .query("execution_logs")
      .withIndex("by_userId_createdAt", (q) => q.eq("userId", args.userId))
      .order("desc");
    if (args.limit) {
      return await q.take(args.limit);
    }
    return await q.collect();
  },
});

export const listByRule = query({
  args: {
    ruleId: v.id("execution_rules"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const q = ctx.db
      .query("execution_logs")
      .withIndex("by_ruleId", (q) => q.eq("ruleId", args.ruleId))
      .order("desc");
    if (args.limit) {
      return await q.take(args.limit);
    }
    return await q.collect();
  },
});

export const get = query({
  args: { id: v.id("execution_logs") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: {
    ruleId: v.id("execution_rules"),
    ruleName: v.string(),
    userId: v.string(),
    triggerSlug: v.optional(v.string()),
    status: v.union(
      v.literal("success"),
      v.literal("failure"),
      v.literal("partial")
    ),
    stepsJson: v.any(),
    outputText: v.optional(v.string()),
    errorText: v.optional(v.string()),
    durationMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("execution_logs", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const stats = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const logs = await ctx.db
      .query("execution_logs")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    const total = logs.length;
    const success = logs.filter((l) => l.status === "success").length;
    const failure = logs.filter((l) => l.status === "failure").length;
    const partial = logs.filter((l) => l.status === "partial").length;
    const avgDuration =
      total > 0
        ? logs.reduce((sum, l) => sum + (l.durationMs ?? 0), 0) / total
        : 0;

    return { total, success, failure, partial, avgDuration };
  },
});
