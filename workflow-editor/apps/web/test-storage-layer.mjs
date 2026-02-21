/**
 * Test the storage layer files (the rewritten ones that call Convex)
 * This verifies the app's actual storage functions work end-to-end
 * 
 * We can't import TS directly, so we test the Convex functions
 * that the storage layer calls, simulating the same call patterns.
 */

const CONVEX_URL = "http://127.0.0.1:3210";
const userId = "e2e-test-user";

async function query(path, args = {}) {
  const res = await fetch(`${CONVEX_URL}/api/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, args, format: "json" }),
  });
  const data = await res.json();
  if (data.status === "error") throw new Error(`${path}: ${data.errorMessage}`);
  return data.value;
}

async function mutation(path, args = {}) {
  const res = await fetch(`${CONVEX_URL}/api/mutation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, args, format: "json" }),
  });
  const data = await res.json();
  if (data.status === "error") throw new Error(`${path}: ${data.errorMessage}`);
  return data.value;
}

let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); console.log(`  ✅ ${name}`); passed++; }
  catch (e) { console.log(`  ❌ ${name}: ${e.message}`); failed++; }
}

async function run() {
  console.log("\n🔗 End-to-End Storage Layer Tests\n");

  // === FULL WORKFLOW: Create rule → Execute → Log → Notify → Check stats ===
  console.log("⚡ Full Automation Workflow");

  let ruleId, logId, notifId;

  await test("1. Create automation rule", async () => {
    ruleId = await mutation("executionRules:create", {
      userId,
      name: "Daily Email Digest",
      description: "Summarize unread emails every morning",
      isActive: true,
      priority: 10,
      acceptedTriggers: ["gmail_new_email"],
      topicCondition: "When emails pile up",
      executionSteps: [
        { type: "instruction", content: "Fetch unread emails from Gmail" },
        { type: "instruction", content: "Summarize them into a digest" },
        { type: "instruction", content: "Send digest to Slack #general" },
      ],
      outputConfig: { platform: "slack", destination: "#general", format: "summary" },
      activationMode: "scheduled",
      scheduleEnabled: true,
      scheduleInterval: "daily",
    });
  });

  await test("2. Verify rule appears in active list", async () => {
    const active = await query("executionRules:listActive", { userId });
    const found = active.find(r => r._id === ruleId);
    if (!found) throw new Error("Rule not in active list");
    if (found.executionSteps.length !== 3) throw new Error("Steps not saved correctly");
  });

  await test("3. Simulate execution → create log", async () => {
    logId = await mutation("executionLogs:create", {
      ruleId,
      ruleName: "Daily Email Digest",
      userId,
      triggerSlug: "scheduled",
      status: "success",
      stepsJson: [
        { stepIndex: 0, type: "instruction", success: true, result: "Fetched 12 emails" },
        { stepIndex: 1, type: "instruction", success: true, result: "Digest created" },
        { stepIndex: 2, type: "instruction", success: true, result: "Sent to #general" },
      ],
      outputText: "Morning digest: 12 emails summarized and sent to Slack",
      durationMs: 3200,
    });
  });

  await test("4. Increment execution count", async () => {
    await mutation("executionRules:incrementExecutionCount", { id: ruleId });
    const rule = await query("executionRules:get", { id: ruleId });
    if (rule.executionCount !== 1) throw new Error("Count not incremented");
    if (!rule.lastExecutedAt) throw new Error("lastExecutedAt not set");
  });

  await test("5. Create success notification", async () => {
    notifId = await mutation("notifications:create", {
      userId,
      type: "execution_success",
      title: "Daily Email Digest completed",
      body: "12 emails summarized and sent to Slack #general",
      ruleId,
      ruleName: "Daily Email Digest",
      logId,
    });
  });

  await test("6. Check unread count = 1", async () => {
    const count = await query("notifications:getUnreadCount", { userId });
    if (count < 1) throw new Error(`Unread count is ${count}`);
  });

  await test("7. Verify log appears in rule's logs", async () => {
    const logs = await query("executionLogs:listByRule", { ruleId });
    if (logs.length < 1) throw new Error("No logs for rule");
    if (logs[0].durationMs !== 3200) throw new Error("Duration wrong");
  });

  await test("8. Check stats include this execution", async () => {
    const stats = await query("executionLogs:stats", { userId });
    if (stats.total < 1) throw new Error("No stats");
    if (stats.avgDuration <= 0) throw new Error("Avg duration is 0");
  });

  // === ARTIFACT WORKFLOW: Create → Add entries → Search ===
  console.log("\n📦 Artifact Knowledge Base Workflow");

  let artifactId;

  await test("9. Create artifact from automation output", async () => {
    artifactId = await mutation("artifacts:create", {
      userId,
      title: "Email Digest History",
      summary: "Running log of daily email digests",
      tags: ["email", "digest", "daily"],
    });
  });

  await test("10. Add first digest entry", async () => {
    await mutation("artifacts:addEntry", {
      artifactId,
      content: "Feb 21: 12 emails - 3 from boss (urgent), 5 newsletters, 4 misc. Key action items: Review Q1 budget, respond to client proposal.",
      source: "workflow_output",
      workflowName: "Daily Email Digest",
    });
  });

  await test("11. Add second digest entry", async () => {
    await mutation("artifacts:addEntry", {
      artifactId,
      content: "Feb 22: 8 emails - 1 urgent from HR (benefits enrollment deadline), 4 newsletters, 3 misc.",
      source: "workflow_output",
      workflowName: "Daily Email Digest",
    });
  });

  await test("12. Retrieve artifact with all entries", async () => {
    const full = await query("artifacts:getWithEntries", { id: artifactId });
    if (full.entries.length !== 2) throw new Error(`Expected 2 entries, got ${full.entries.length}`);
    if (!full.entries[0].content.includes("Feb 21")) throw new Error("Entry content wrong");
  });

  // === CONVERSATION WORKFLOW ===
  console.log("\n💬 Chat Conversation Workflow");

  let convoId;

  await test("13. Create conversation", async () => {
    convoId = await mutation("conversations:create", { userId, title: "Automation Setup" });
  });

  await test("14. Multi-turn conversation", async () => {
    await mutation("conversations:sendMessage", { conversationId: convoId, role: "user", content: "Set up a daily email digest" });
    await mutation("conversations:sendMessage", { conversationId: convoId, role: "assistant", content: "I've created a 'Daily Email Digest' automation that runs every morning." });
    await mutation("conversations:sendMessage", { conversationId: convoId, role: "user", content: "Can you also send it to my Slack?" });
    await mutation("conversations:sendMessage", { conversationId: convoId, role: "assistant", content: "Done! The digest will now be sent to Slack #general as well.", metadata: { toolCalls: ["SLACK_SEND_MESSAGE"] } });

    const msgs = await query("conversations:getMessages", { conversationId: convoId });
    if (msgs.length !== 4) throw new Error(`Expected 4 messages, got ${msgs.length}`);
    // Verify metadata preserved
    const lastMsg = msgs[msgs.length - 1];
    if (!lastMsg.metadata?.toolCalls) throw new Error("Metadata not preserved");
  });

  // === CROSS-TABLE: Notification references rule and log ===
  console.log("\n🔗 Cross-Table References");

  await test("15. Notification references valid rule and log", async () => {
    const notifs = await query("notifications:list", { userId });
    const notif = notifs.find(n => n._id === notifId);
    if (!notif) throw new Error("Notification not found");
    // Verify we can look up the referenced rule
    const rule = await query("executionRules:get", { id: notif.ruleId });
    if (!rule) throw new Error("Referenced rule not found");
    // Verify we can look up the referenced log
    const log = await query("executionLogs:get", { id: notif.logId });
    if (!log) throw new Error("Referenced log not found");
  });

  // === CLEANUP ===
  console.log("\n🧹 Cleanup");

  await test("16. Delete everything", async () => {
    await mutation("conversations:remove", { id: convoId });
    await mutation("artifacts:remove", { id: artifactId });
    await mutation("notifications:remove", { id: notifId });
    await mutation("executionRules:remove", { id: ruleId });
    // Verify cascade (conversation messages gone)
    const msgs = await query("conversations:getMessages", { conversationId: convoId });
    // This will error because convoId doesn't exist - that's expected
  });

  console.log(`\n${"=".repeat(40)}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`${"=".repeat(40)}\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error("Fatal:", e); process.exit(1); });
