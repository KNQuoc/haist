import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const list = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("execution_rules")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

export const listActive = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("execution_rules")
      .withIndex("by_userId_isActive", (q) =>
        q.eq("userId", args.userId).eq("isActive", true)
      )
      .collect();
  },
});

export const get = query({
  args: { id: v.id("execution_rules") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: {
    userId: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    isActive: v.boolean(),
    priority: v.number(),
    acceptedTriggers: v.array(v.string()),
    topicCondition: v.optional(v.string()),
    executionSteps: v.array(
      v.object({
        type: v.string(),
        content: v.optional(v.string()),
        toolName: v.optional(v.string()),
        parameters: v.optional(v.any()),
      })
    ),
    outputConfig: v.optional(
      v.object({
        platform: v.optional(v.string()),
        destination: v.optional(v.string()),
        format: v.optional(v.string()),
        template: v.optional(v.string()),
      })
    ),
    activationMode: v.union(
      v.literal("trigger"),
      v.literal("manual"),
      v.literal("scheduled"),
      v.literal("all")
    ),
    scheduleEnabled: v.optional(v.boolean()),
    scheduleInterval: v.optional(
      v.union(
        v.literal("15min"),
        v.literal("hourly"),
        v.literal("daily"),
        v.literal("weekly")
      )
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("execution_rules", {
      ...args,
      executionCount: 0,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("execution_rules"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    priority: v.optional(v.number()),
    acceptedTriggers: v.optional(v.array(v.string())),
    topicCondition: v.optional(v.string()),
    executionSteps: v.optional(
      v.array(
        v.object({
          type: v.string(),
          content: v.optional(v.string()),
          toolName: v.optional(v.string()),
          parameters: v.optional(v.any()),
        })
      )
    ),
    outputConfig: v.optional(
      v.object({
        platform: v.optional(v.string()),
        destination: v.optional(v.string()),
        format: v.optional(v.string()),
        template: v.optional(v.string()),
      })
    ),
    activationMode: v.optional(
      v.union(
        v.literal("trigger"),
        v.literal("manual"),
        v.literal("scheduled"),
        v.literal("all")
      )
    ),
    scheduleEnabled: v.optional(v.boolean()),
    scheduleInterval: v.optional(
      v.union(
        v.literal("15min"),
        v.literal("hourly"),
        v.literal("daily"),
        v.literal("weekly")
      )
    ),
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) updates[key] = value;
    }
    await ctx.db.patch(id, updates);
  },
});

export const remove = mutation({
  args: { id: v.id("execution_rules") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

export const incrementExecutionCount = mutation({
  args: { id: v.id("execution_rules") },
  handler: async (ctx, args) => {
    const rule = await ctx.db.get(args.id);
    if (!rule) return;
    await ctx.db.patch(args.id, {
      executionCount: rule.executionCount + 1,
      lastExecutedAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});
