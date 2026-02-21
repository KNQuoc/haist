import { v } from "convex/values";
import { query, mutation, action } from "./_generated/server";

export const list = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("artifacts")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  },
});

export const get = query({
  args: { id: v.id("artifacts") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getWithEntries = query({
  args: { id: v.id("artifacts") },
  handler: async (ctx, args) => {
    const artifact = await ctx.db.get(args.id);
    if (!artifact) return null;
    const entries = await ctx.db
      .query("artifact_entries")
      .withIndex("by_artifactId", (q) => q.eq("artifactId", args.id))
      .collect();
    return { ...artifact, entries };
  },
});

export const create = mutation({
  args: {
    userId: v.string(),
    title: v.string(),
    summary: v.optional(v.string()),
    tags: v.array(v.string()),
    embedding: v.optional(v.array(v.float64())),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("artifacts", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("artifacts"),
    title: v.optional(v.string()),
    summary: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    embedding: v.optional(v.array(v.float64())),
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
  args: { id: v.id("artifacts") },
  handler: async (ctx, args) => {
    // Delete entries first
    const entries = await ctx.db
      .query("artifact_entries")
      .withIndex("by_artifactId", (q) => q.eq("artifactId", args.id))
      .collect();
    for (const entry of entries) {
      await ctx.db.delete(entry._id);
    }
    await ctx.db.delete(args.id);
  },
});

export const addEntry = mutation({
  args: {
    artifactId: v.id("artifacts"),
    workflowId: v.optional(v.string()),
    workflowName: v.optional(v.string()),
    content: v.string(),
    source: v.union(
      v.literal("workflow_output"),
      v.literal("manual"),
      v.literal("ai_summary")
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.artifactId, { updatedAt: Date.now() });
    return await ctx.db.insert("artifact_entries", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const search = action({
  args: {
    userId: v.string(),
    embedding: v.array(v.float64()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const results = await ctx.vectorSearch("artifacts", "by_embedding", {
      vector: args.embedding,
      limit: args.limit ?? 10,
      filter: (q) => q.eq("userId", args.userId),
    });
    return results;
  },
});
