# Composio Tool Router Reference Guide

## Overview

Composio Tool Router provides AI agents with access to external services (GitHub, Gmail, Slack, etc.) through a unified interface. It handles authentication, OAuth flows, and tool execution automatically.

---

## Core Concepts

### User ID
- An identifier from your system (database ID, UUID, or unique string)
- Scopes connected accounts and tool access to a specific user
- Can represent individuals, teams, or organizations

### Session
An ephemeral configuration that combines:
- Which user's connected accounts to use
- Which toolkits are available
- Which auth configs to use

### Toolkit vs Tool
- **Toolkit**: Collection of related tools for a service (e.g., `github`, `gmail`, `linear`)
- **Tool**: Individual action (e.g., `GITHUB_CREATE_A_COMMIT`, `GMAIL_SEND_EMAIL`)

---

## Basic Usage

### Initialize Composio
```typescript
import { Composio } from "@composio/core";

// API key from env var COMPOSIO_API_KEY or pass explicitly
const composio = new Composio();
// or
const composio = new Composio({ apiKey: "your-key" });
```

### Create a Session
```typescript
const session = await composio.create("user_123");
```

### Get MCP Server URL (for OpenAI Agents, etc.)
```typescript
const { mcp } = session;
console.log(mcp.url);     // MCP server URL
console.log(mcp.headers); // Authentication headers
```

---

## Session Configuration Options

### Enable Specific Toolkits Only
```typescript
// Array format
const session = await composio.create("user_123", {
  toolkits: ["github", "gmail", "slack"],
});

// Object format
const session = await composio.create("user_123", {
  toolkits: { enable: ["github", "gmail", "slack"] },
});
```

### Disable Specific Toolkits
```typescript
const session = await composio.create("user_123", {
  toolkits: { disable: ["exa", "firecrawl"] },
});
```

### Custom Auth Configs
Use your own OAuth credentials instead of Composio's defaults:
```typescript
const session = await composio.create("user_123", {
  authConfigs: {
    github: "ac_your_github_config",
    slack: "ac_your_slack_config",
  },
});
```

### Connected Account Selection
If a user has multiple connected accounts for the same toolkit:
```typescript
const session = await composio.create("user_123", {
  connectedAccounts: {
    gmail: "ca_work_gmail",
    github: "ca_personal_github",
  },
});
```

---

## Auth Config ID Naming Convention

When using auth configs from environment variables, the **app names must be lowercase** (no underscores/spaces):

| Service | Composio App Name | Env Variable Example |
|---------|-------------------|----------------------|
| Gmail | `gmail` | `GMAIL_AUTH_CONFIG_ID` |
| GitHub | `github` | `GITHUB_AUTH_CONFIG_ID` |
| Slack | `slack` | `SLACK_AUTH_CONFIG_ID` |
| Notion | `notion` | `NOTION_AUTH_CONFIG_ID` |
| Linear | `linear` | `LINEAR_AUTH_CONFIG_ID` |
| Exa | `exa` | `EXA_AUTH_CONFIG_ID` |
| Canva | `canva` | `CANVA_AUTH_CONFIG_ID` |
| Outlook | `outlook` | `OUTLOOK_AUTH_CONFIG_ID` |
| Google Calendar | `googlecalendar` | `GOOGLE_CALENDAR_AUTH_CONFIG_ID` |
| Google Drive | `googledrive` | `GOOGLE_DRIVE_AUTH_CONFIG_ID` |
| Google Docs | `googledocs` | `GOOGLE_DOCS_AUTH_CONFIG_ID` |
| Google Sheets | `googlesheets` | `GOOGLE_SHEETS_AUTH_CONFIG_ID` |

---

## Authentication

### In-Chat Authentication (Default)
When a tool requires authentication, the agent prompts the user with a Connect Link. The user authenticates and confirms in chat.

### Manual Authentication
For apps that manage auth outside of chat:
```typescript
const connectionRequest = await session.authorize("github", {
  callbackUrl: "https://myapp.com/callback",
});
console.log(connectionRequest.redirectUrl);
// Wait for user to complete auth
const connectedAccount = await connectionRequest.waitForConnection();
```

### Auth Config Selection Precedence
When executing a tool, Tool Router selects the connected account in this order:
1. `connectedAccounts` override if provided in session config
2. `authConfigs` override - finds or creates connection on that config
3. Auth config previously created by Tool Router for this toolkit
4. Creates new auth config using Composio managed auth
5. Error if no Composio managed auth scheme exists

---

## Session Methods

### `session.mcp`
Get MCP server URL for MCP-compatible clients:
```typescript
const { mcp } = session;
console.log(mcp.url);
console.log(mcp.headers);
```

### `session.tools()`
Get native tools for use with AI frameworks:
```typescript
const tools = await session.tools();
```

### `session.authorize(toolkit, options?)`
Manually authenticate a user to a toolkit:
```typescript
const connectionRequest = await session.authorize("github");
console.log(connectionRequest.redirectUrl);
```

### `session.toolkits()`
List available toolkits and their connection status:
```typescript
const toolkits = await session.toolkits();
toolkits.items.forEach((toolkit) => {
  console.log(`${toolkit.name}: ${toolkit.connection.connectedAccount?.id ?? "Not connected"}`);
});
```

---

## Integration with OpenAI Agents

```typescript
import { Composio } from "@composio/core";
import { Agent, run, hostedMcpTool, MemorySession } from "@openai/agents";

const composio = new Composio();
const session = await composio.create("user_123", {
  authConfigs: {
    gmail: process.env.GMAIL_AUTH_CONFIG_ID,
    github: process.env.GITHUB_AUTH_CONFIG_ID,
    // ... other auth configs
  },
});

const agent = new Agent({
  name: "Personal Assistant",
  instructions: "You are a helpful assistant.",
  model: "gpt-4",
  tools: [
    hostedMcpTool({
      serverLabel: "composio",
      serverUrl: session.mcp.url,
      headers: session.mcp.headers,
    }),
  ],
});

const memory = new MemorySession();
const result = await run(agent, "Star the composio repo on GitHub", { session: memory });
```

---

## Common Patterns

### Loading Auth Configs from Environment
```typescript
const authConfigs: Record<string, string> = {};

const authConfigMapping: Record<string, string | undefined> = {
  gmail: process.env.GMAIL_AUTH_CONFIG_ID,
  googlecalendar: process.env.GOOGLE_CALENDAR_AUTH_CONFIG_ID,
  github: process.env.GITHUB_AUTH_CONFIG_ID,
  slack: process.env.SLACK_AUTH_CONFIG_ID,
  exa: process.env.EXA_AUTH_CONFIG_ID,
  // ... add more as needed
};

// Only include defined configs
for (const [app, configId] of Object.entries(authConfigMapping)) {
  if (configId) {
    authConfigs[app] = configId;
  }
}

const session = await composio.create(userId, { authConfigs });
```

### Listing Available Toolkits
```typescript
const toolkits = await composio.toolkits.get();
for (const toolkit of toolkits) {
  console.log(toolkit.name);
}
```

---

## Environment Variables

```env
# Required
COMPOSIO_API_KEY=ak_xxxxx

# Auth Config IDs (from Composio dashboard)
GMAIL_AUTH_CONFIG_ID=ac_xxxxx
GOOGLE_CALENDAR_AUTH_CONFIG_ID=ac_xxxxx
GITHUB_AUTH_CONFIG_ID=ac_xxxxx
SLACK_AUTH_CONFIG_ID=ac_xxxxx
NOTION_AUTH_CONFIG_ID=ac_xxxxx
LINEAR_AUTH_CONFIG_ID=ac_xxxxx
# ... etc
```

---

## Capturing Workflow Outputs

Tool Router returns workflow outputs through the `run()` function result. Here's how to capture them:

### Basic Output Capture
```typescript
const result = await run(agent, input, { session: memory });
const output = result.finalOutput ?? "";
```

### Structured Output Capture
```typescript
interface WorkflowOutput {
  timestamp: string;
  input: string;
  output: string;
  success: boolean;
  error?: string;
}

const workflowOutputs: WorkflowOutput[] = [];

function captureWorkflowOutput(input: string, output: string, success: boolean, error?: string): WorkflowOutput {
  const workflowOutput: WorkflowOutput = {
    timestamp: new Date().toISOString(),
    input,
    output,
    success,
    error,
  };
  workflowOutputs.push(workflowOutput);
  return workflowOutput;
}

// Usage
try {
  const result = await run(agent, input, { session: memory });
  captureWorkflowOutput(input, result.finalOutput ?? "", true);
} catch (error) {
  captureWorkflowOutput(input, "", false, error.message);
}
```

### Saving Outputs to File
```typescript
import { writeFileSync } from "fs";

function saveWorkflowOutputs(filename: string = "workflow_outputs.json"): void {
  writeFileSync(filename, JSON.stringify(workflowOutputs, null, 2));
}
```

### Best Practices for Output Capture

1. **Structure prompts for clear outputs** - Ask for specific formats:
   ```
   "Query all users and provide: Total count, list of names, and creation dates"
   ```

2. **Use session management** - Sessions maintain context across workflow steps

3. **Implement error handling** - Always capture both success and failure cases

---

## Key Points to Remember

1. **Auth config IDs** start with `ac_` prefix
2. **Connected account IDs** start with `ca_` prefix
3. **App names in authConfigs** must be lowercase with no underscores (e.g., `googlecalendar` not `GOOGLE_CALENDAR`)
4. **Sessions are ephemeral** - connected accounts persist across sessions
5. **Default behavior** - all toolkits are available unless explicitly restricted
6. **MCP protocol** - Tool Router uses Model Context Protocol for tool communication
