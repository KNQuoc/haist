/**
 * Test all Convex endpoints against the local backend
 * Run: node test-convex.mjs
 */

const CONVEX_URL = "http://127.0.0.1:3210";

async function convexQuery(path, args = {}) {
  const res = await fetch(`${CONVEX_URL}/api/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, args, format: "json" }),
  });
  const data = await res.json();
  if (data.status === "error") throw new Error(`Query ${path}: ${data.errorMessage}`);
  return data.value;
}

async function convexMutation(path, args = {}) {
  const res = await fetch(`${CONVEX_URL}/api/mutation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, args, format: "json" }),
  });
  const data = await res.json();
  if (data.status === "error") throw new Error(`Mutation ${path}: ${data.errorMessage}`);
  return data.value;
}

async function convexAction(path, args = {}) {
  const res = await fetch(`${CONVEX_URL}/api/action`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, args, format: "json" }),
  });
  const data = await res.json();
  if (data.status === "error") throw new Error(`Action ${path}: ${data.errorMessage}`);
  return data.value;
}

const userId = "test-user-123";
let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ❌ ${name}: ${e.message}`);
    failed++;
  }
}

async function run() {
  console.log("\n🧪 Testing Convex Endpoints\n");

  // === EXECUTION RULES ===
  console.log("📋 Execution Rules");
  let ruleId;

  await test("create rule", async () => {
    ruleId = await convexMutation("executionRules:create", {
      userId,
      name: "Test Rule",
      description: "A test automation rule",
      isActive: true,
      priority: 5,
      acceptedTriggers: ["gmail_new_email"],
      topicCondition: "When I get an email from boss",
      executionSteps: [{ type: "instruction", content: "Forward to Slack" }],
      outputConfig: { platform: "slack", format: "summary" },
      activationMode: "trigger",
    });
    if (!ruleId) throw new Error("No ID returned");
  });

  await test("get rule", async () => {
    const rule = await convexQuery("executionRules:get", { id: ruleId });
    if (rule.name !== "Test Rule") throw new Error("Wrong name");
  });

  await test("list rules", async () => {
    const rules = await convexQuery("executionRules:list", { userId });
    if (rules.length < 1) throw new Error("Empty list");
  });

  await test("list active rules", async () => {
    const rules = await convexQuery("executionRules:listActive", { userId });
    if (rules.length < 1) throw new Error("Empty list");
  });

  await test("update rule", async () => {
    await convexMutation("executionRules:update", { id: ruleId, name: "Updated Rule", priority: 10 });
    const rule = await convexQuery("executionRules:get", { id: ruleId });
    if (rule.name !== "Updated Rule") throw new Error("Update failed");
    if (rule.priority !== 10) throw new Error("Priority not updated");
  });

  await test("increment execution count", async () => {
    await convexMutation("executionRules:incrementExecutionCount", { id: ruleId });
    const rule = await convexQuery("executionRules:get", { id: ruleId });
    if (rule.executionCount !== 1) throw new Error(`Count is ${rule.executionCount}`);
  });

  // === EXECUTION LOGS ===
  console.log("\n📊 Execution Logs");
  let logId;

  await test("create log", async () => {
    logId = await convexMutation("executionLogs:create", {
      ruleId,
      ruleName: "Updated Rule",
      userId,
      triggerSlug: "gmail_new_email",
      status: "success",
      stepsJson: [{ stepIndex: 0, type: "instruction", success: true, result: "Forwarded" }],
      outputText: "Email forwarded to #general",
      durationMs: 1500,
    });
    if (!logId) throw new Error("No ID returned");
  });

  await test("get log", async () => {
    const log = await convexQuery("executionLogs:get", { id: logId });
    if (log.status !== "success") throw new Error("Wrong status");
  });

  await test("list logs", async () => {
    const logs = await convexQuery("executionLogs:list", { userId, limit: 10 });
    if (logs.length < 1) throw new Error("Empty list");
  });

  await test("list logs by rule", async () => {
    const logs = await convexQuery("executionLogs:listByRule", { ruleId, limit: 5 });
    if (logs.length < 1) throw new Error("Empty list");
  });

  await test("stats", async () => {
    const s = await convexQuery("executionLogs:stats", { userId });
    if (s.total !== 1) throw new Error(`Total is ${s.total}`);
    if (s.success !== 1) throw new Error(`Success is ${s.success}`);
  });

  // === NOTIFICATIONS ===
  console.log("\n🔔 Notifications");
  let notifId;

  await test("create notification", async () => {
    notifId = await convexMutation("notifications:create", {
      userId,
      type: "execution_success",
      title: "Rule executed",
      body: "Updated Rule ran successfully",
      ruleId,
      ruleName: "Updated Rule",
      logId,
    });
    if (!notifId) throw new Error("No ID returned");
  });

  await test("list notifications", async () => {
    const notifs = await convexQuery("notifications:list", { userId });
    if (notifs.length < 1) throw new Error("Empty list");
  });

  await test("unread count", async () => {
    const count = await convexQuery("notifications:getUnreadCount", { userId });
    if (count < 1) throw new Error(`Count is ${count}`);
  });

  await test("mark read", async () => {
    await convexMutation("notifications:markRead", { id: notifId });
    const count = await convexQuery("notifications:getUnreadCount", { userId });
    if (count !== 0) throw new Error(`Count is ${count}`);
  });

  await test("mark all read (create 2 more first)", async () => {
    await convexMutation("notifications:create", { userId, type: "info", title: "Test 1" });
    await convexMutation("notifications:create", { userId, type: "suggestion", title: "Test 2" });
    await convexMutation("notifications:markAllRead", { userId });
    const count = await convexQuery("notifications:getUnreadCount", { userId });
    if (count !== 0) throw new Error(`Count is ${count}`);
  });

  // === ARTIFACTS ===
  console.log("\n📦 Artifacts");
  let artifactId, entryId;

  await test("create artifact", async () => {
    artifactId = await convexMutation("artifacts:create", {
      userId,
      title: "Meeting Notes",
      summary: "Notes from team meetings",
      tags: ["meetings", "team"],
    });
    if (!artifactId) throw new Error("No ID returned");
  });

  await test("get artifact", async () => {
    const a = await convexQuery("artifacts:get", { id: artifactId });
    if (a.title !== "Meeting Notes") throw new Error("Wrong title");
  });

  await test("list artifacts", async () => {
    const arts = await convexQuery("artifacts:list", { userId });
    if (arts.length < 1) throw new Error("Empty list");
  });

  await test("add entry", async () => {
    entryId = await convexMutation("artifacts:addEntry", {
      artifactId,
      content: "Discussed Q1 goals and roadmap priorities.",
      source: "manual",
      workflowName: "Meeting Capture",
    });
    if (!entryId) throw new Error("No ID returned");
  });

  await test("get with entries", async () => {
    const a = await convexQuery("artifacts:getWithEntries", { id: artifactId });
    if (!a.entries || a.entries.length < 1) throw new Error("No entries");
    if (a.entries[0].content !== "Discussed Q1 goals and roadmap priorities.") throw new Error("Wrong content");
  });

  await test("update artifact", async () => {
    await convexMutation("artifacts:update", { id: artifactId, title: "Team Meeting Notes", tags: ["meetings", "team", "q1"] });
    const a = await convexQuery("artifacts:get", { id: artifactId });
    if (a.title !== "Team Meeting Notes") throw new Error("Update failed");
    if (a.tags.length !== 3) throw new Error("Tags not updated");
  });

  // === CONVERSATIONS ===
  console.log("\n💬 Conversations");
  let convoId, msgId;

  await test("create conversation", async () => {
    convoId = await convexMutation("conversations:create", { userId, title: "Test Chat" });
    if (!convoId) throw new Error("No ID returned");
  });

  await test("get conversation", async () => {
    const c = await convexQuery("conversations:get", { id: convoId });
    if (c.title !== "Test Chat") throw new Error("Wrong title");
  });

  await test("list conversations", async () => {
    const convos = await convexQuery("conversations:list", { userId });
    if (convos.length < 1) throw new Error("Empty list");
  });

  await test("send message", async () => {
    msgId = await convexMutation("conversations:sendMessage", {
      conversationId: convoId,
      role: "user",
      content: "Hello, haist!",
    });
    if (!msgId) throw new Error("No ID returned");
  });

  await test("send assistant message", async () => {
    await convexMutation("conversations:sendMessage", {
      conversationId: convoId,
      role: "assistant",
      content: "Hey! How can I help you automate things?",
      metadata: { model: "minimax-m2.5" },
    });
  });

  await test("get messages", async () => {
    const msgs = await convexQuery("conversations:getMessages", { conversationId: convoId });
    if (msgs.length !== 2) throw new Error(`Expected 2, got ${msgs.length}`);
  });

  await test("update title", async () => {
    await convexMutation("conversations:updateTitle", { id: convoId, title: "Renamed Chat" });
    const c = await convexQuery("conversations:get", { id: convoId });
    if (c.title !== "Renamed Chat") throw new Error("Title not updated");
  });

  // === CLEANUP ===
  console.log("\n🧹 Cleanup");

  await test("delete conversation (cascades messages)", async () => {
    await convexMutation("conversations:remove", { id: convoId });
    const c = await convexQuery("conversations:get", { id: convoId });
    if (c !== null) throw new Error("Not deleted");
  });

  await test("delete artifact (cascades entries)", async () => {
    await convexMutation("artifacts:remove", { id: artifactId });
    const a = await convexQuery("artifacts:get", { id: artifactId });
    if (a !== null) throw new Error("Not deleted");
  });

  await test("delete notification", async () => {
    await convexMutation("notifications:remove", { id: notifId });
  });

  await test("delete rule", async () => {
    await convexMutation("executionRules:remove", { id: ruleId });
    const r = await convexQuery("executionRules:get", { id: ruleId });
    if (r !== null) throw new Error("Not deleted");
  });

  // === SUMMARY ===
  console.log(`\n${"=".repeat(40)}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Total: ${passed + failed}`);
  console.log(`${"=".repeat(40)}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
