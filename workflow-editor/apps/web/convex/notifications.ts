import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const list = query({
  args: { userId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const q = ctx.db
      .query("notifications")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .order("desc");
    return args.limit ? await q.take(args.limit) : await q.collect();
  },
});

export const getUnreadCount = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_userId_read", (q) =>
        q.eq("userId", args.userId).eq("read", false)
      )
      .collect();
    return unread.length;
  },
});

export const create = mutation({
  args: {
    userId: v.string(),
    type: v.union(
      v.literal("execution_success"),
      v.literal("execution_failure"),
      v.literal("needs_approval"),
      v.literal("suggestion"),
      v.literal("info")
    ),
    title: v.string(),
    body: v.optional(v.string()),
    ruleId: v.optional(v.id("execution_rules")),
    ruleName: v.optional(v.string()),
    logId: v.optional(v.id("execution_logs")),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("notifications", {
      ...args,
      read: false,
      createdAt: Date.now(),
    });
  },
});

export const markRead = mutation({
  args: { id: v.id("notifications") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { read: true });
  },
});

export const markAllRead = mutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_userId_read", (q) =>
        q.eq("userId", args.userId).eq("read", false)
      )
      .collect();
    for (const n of unread) {
      await ctx.db.patch(n._id, { read: true });
    }
  },
});

export const remove = mutation({
  args: { id: v.id("notifications") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
