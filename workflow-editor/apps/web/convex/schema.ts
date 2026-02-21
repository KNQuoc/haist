import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    email: v.string(),
    name: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_email", ["email"]),

  execution_rules: defineTable({
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
    executionCount: v.number(),
    lastExecutedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
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
    scheduleLastRun: v.optional(v.number()),
    scheduleNextRun: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_isActive", ["userId", "isActive"]),

  execution_logs: defineTable({
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
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_ruleId", ["ruleId"])
    .index("by_userId_createdAt", ["userId", "createdAt"]),

  notifications: defineTable({
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
    read: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_read", ["userId", "read"]),

  artifacts: defineTable({
    userId: v.string(),
    title: v.string(),
    summary: v.optional(v.string()),
    tags: v.array(v.string()),
    embedding: v.optional(v.array(v.float64())),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 1536,
      filterFields: ["userId"],
    }),

  artifact_entries: defineTable({
    artifactId: v.id("artifacts"),
    workflowId: v.optional(v.string()),
    workflowName: v.optional(v.string()),
    content: v.string(),
    source: v.union(
      v.literal("workflow_output"),
      v.literal("manual"),
      v.literal("ai_summary")
    ),
    createdAt: v.number(),
  }).index("by_artifactId", ["artifactId"]),

  conversations: defineTable({
    userId: v.string(),
    title: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_userId", ["userId"]),

  messages: defineTable({
    conversationId: v.id("conversations"),
    role: v.union(
      v.literal("user"),
      v.literal("assistant"),
      v.literal("system")
    ),
    content: v.string(),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
  }).index("by_conversationId", ["conversationId"]),
});
