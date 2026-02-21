# Plan: Complete Workflow Context & Decision Tracking System

> **Status**: Draft - saved for future implementation
> **Created**: 2026-01-13
> **Last Updated**: 2026-01-13

## Goal
Enable AI agents to understand the full reasoning chain - not just what's happening in the current workflow, but WHY it was triggered and what decisions were made in related past workflows.

## Three Components

| Component | Purpose | Example |
|-----------|---------|---------|
| **1. Execution Context** | Track decisions during current workflow | "Step 2 decided X because of Y" |
| **2. Context Discovery Agent** | Gather upstream context at workflow start | "HR wants this report because of these emails..." |
| **3. Workflow Memory** | Persist summaries across workflow runs | "Last week we decided Z on similar topic" |

---

# Part 1: Workflow Execution Context

## Goal
Track full execution trace + accumulated summary during workflow execution.

## Type Definitions
**File:** `workflow-editor/packages/core/src/types/workflow.types.ts`

```typescript
export interface StepExecutionRecord {
  nodeId: string;
  nodeLabel: string;
  bubbleType: string;
  input: Record<string, unknown>;
  output: unknown;
  success: boolean;
  error?: string;
  timestamp: string;
  durationMs: number;
  reasoning?: string;
  decisions?: Array<{ question: string; answer: string; confidence?: 'high' | 'medium' | 'low' }>;
}

export interface WorkflowExecutionContext {
  executionId: string;
  workflowName: string;
  startedAt: string;
  currentStepIndex: number;
  totalSteps: number;
  executionTrace: StepExecutionRecord[];
  accumulatedSummary: string;
  triggerPayload: unknown;
  keyDataPoints: Record<string, unknown>;
  // NEW: upstream context from discovery agent
  upstreamContext?: UpstreamContext;
  // NEW: related past workflows
  relatedWorkflowMemories?: WorkflowMemorySummary[];
}

export interface UpstreamContext {
  discoveredAt: string;
  sources: Array<{
    type: 'email' | 'slack' | 'notion' | 'document' | 'other';
    title: string;
    summary: string;
    relevanceScore?: number;
    rawData?: unknown;
  }>;
  synthesizedContext: string;  // AI-generated summary of why this workflow was triggered
}

export interface WorkflowMemorySummary {
  workflowId: string;
  workflowName: string;
  executedAt: string;
  triggerSummary: string;
  keyDecisions: string[];
  outcome: string;
  relevanceScore?: number;
}
```

## Code Generator Changes
**File:** `workflow-editor/packages/codegen/src/generators/bubbleflow-generator.ts`

1. Initialize `workflowContext` at workflow start
2. Update context after each node execution
3. Pass context to AI agents via `workflowContext` parameter
4. Add decision-tracking instructions to AI system prompts

---

# Part 2: Context Discovery Agent

## Goal
A special AI agent that runs at workflow start to gather relevant upstream context from data sources.

## New Bubble: `context-discovery-agent`
**File:** `workflow-editor/packages/core/src/constants/bubble-registry.ts`

```typescript
'context-discovery-agent': {
  name: 'context-discovery-agent',
  className: 'ContextDiscoveryAgentBubble',
  type: 'service',
  shortDescription: 'Discovers relevant context from connected data sources',
  longDescription: 'AI agent that autonomously queries Gmail, Notion, Slack, etc. to find context relevant to the workflow trigger',
  icon: 'search',
  color: '#10B981',
  schema: {
    triggerContext: {
      name: 'triggerContext',
      type: 'string',
      required: true,
      description: 'Description of what triggered this workflow (e.g., "write report on employee performance")',
    },
    dataSources: {
      name: 'dataSources',
      type: 'array',
      required: true,
      description: 'Data sources to query for context',
      // Array of: 'gmail' | 'slack' | 'notion' | 'google-sheets' | 'postgresql'
    },
    maxSourcesPerType: {
      name: 'maxSourcesPerType',
      type: 'number',
      required: false,
      default: 5,
      description: 'Maximum items to fetch per data source',
    },
    lookbackDays: {
      name: 'lookbackDays',
      type: 'number',
      required: false,
      default: 30,
      description: 'How far back to search (in days)',
    },
    includeWorkflowMemory: {
      name: 'includeWorkflowMemory',
      type: 'boolean',
      required: false,
      default: true,
      description: 'Include summaries from related past workflow runs',
    },
  },
  resultSchema: {
    type: 'object',
    properties: {
      upstreamContext: { type: 'object', description: 'Discovered upstream context' },
      relatedMemories: { type: 'array', description: 'Related past workflow summaries' },
      success: { type: 'boolean' },
      error: { type: 'string' },
    },
  },
  authType: 'none',  // Uses credentials from connected data source bubbles
}
```

## How It Works

1. **Receives trigger context**: "HR manager wants to write a report on employee X"
2. **Queries data sources** in parallel:
   - Gmail: Search for emails mentioning "employee X", "performance", "report"
   - Slack: Search for messages in relevant channels
   - Notion: Search for pages/docs about the topic
3. **AI synthesizes findings**: Creates a coherent summary of WHY this workflow was triggered
4. **Injects into workflowContext**: `workflowContext.upstreamContext = discoveredContext`

## Implementation
**New file:** `@bubblelab/bubble-core` package (or local implementation)

```typescript
export class ContextDiscoveryAgentBubble extends BaseBubble {
  async action(): Promise<BubbleResult<UpstreamContext>> {
    const { triggerContext, dataSources, maxSourcesPerType, lookbackDays } = this.config;

    // 1. Build search queries from trigger context
    const searchQueries = await this.generateSearchQueries(triggerContext);

    // 2. Query each data source in parallel
    const sourceResults = await Promise.all(
      dataSources.map(source => this.querySource(source, searchQueries, maxSourcesPerType, lookbackDays))
    );

    // 3. Use AI to synthesize findings
    const synthesizedContext = await this.synthesizeContext(triggerContext, sourceResults);

    // 4. Optionally fetch related workflow memories
    const relatedMemories = this.config.includeWorkflowMemory
      ? await this.fetchRelatedMemories(triggerContext)
      : [];

    return {
      success: true,
      data: {
        discoveredAt: new Date().toISOString(),
        sources: sourceResults.flat(),
        synthesizedContext,
        relatedMemories,
      },
    };
  }
}
```

---

# Part 3: Workflow Memory (Cross-Run Persistence)

## Goal
Store workflow execution summaries so future workflows can reference past decisions.

## Database Schema
**New table or collection:**

```sql
CREATE TABLE workflow_memories (
  id UUID PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  workflow_name TEXT NOT NULL,
  executed_at TIMESTAMP NOT NULL,
  trigger_payload JSONB,
  trigger_summary TEXT,
  key_decisions TEXT[],
  outcome TEXT,
  accumulated_summary TEXT,
  embedding VECTOR(1536),  -- For semantic search
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_workflow_memories_embedding ON workflow_memories
  USING ivfflat (embedding vector_cosine_ops);
```

## Memory Service
**New file:** `apps/web/src/lib/workflow-memory/memory-service.ts`

```typescript
export class WorkflowMemoryService {
  // Save workflow summary after execution
  async saveMemory(context: WorkflowExecutionContext): Promise<void> {
    const summary = this.buildMemorySummary(context);
    const embedding = await this.generateEmbedding(summary.triggerSummary + ' ' + summary.outcome);
    await this.db.insert('workflow_memories', { ...summary, embedding });
  }

  // Find related past workflows
  async findRelatedMemories(query: string, limit = 5): Promise<WorkflowMemorySummary[]> {
    const queryEmbedding = await this.generateEmbedding(query);
    return this.db.query(`
      SELECT * FROM workflow_memories
      ORDER BY embedding <=> $1
      LIMIT $2
    `, [queryEmbedding, limit]);
  }
}
```

## Integration Points

1. **After workflow execution**: Save summary to memory
   - File: `apps/web/src/app/api/workflow/execute/route.ts`
   - Add: `await memoryService.saveMemory(result.workflowContext)`

2. **Context Discovery Agent**: Query memory for related workflows
   - Already included in the agent's `fetchRelatedMemories()` method

---

# Implementation Order

## Phase 1: Execution Context (Foundation)
1. Add types to `workflow.types.ts`
2. Update `bubble-registry.ts` with `workflowContext` param for ai-agent
3. Modify `bubbleflow-generator.ts` to initialize and update context
4. Update `@bubblelab/bubble-core` AIAgentBubble to consume context

## Phase 2: Context Discovery Agent
1. Add `context-discovery-agent` to bubble registry
2. Implement `ContextDiscoveryAgentBubble` class
3. Add helper methods for querying Gmail, Slack, Notion, etc.
4. Add AI synthesis step

## Phase 3: Workflow Memory
1. Create database table/collection
2. Implement `WorkflowMemoryService`
3. Add embedding generation (OpenAI or local)
4. Integrate with workflow execution endpoint
5. Connect to Context Discovery Agent

---

# Critical Files

| File | Changes |
|------|---------|
| `workflow-editor/packages/core/src/types/workflow.types.ts` | New type definitions |
| `workflow-editor/packages/core/src/constants/bubble-registry.ts` | AI agent schema + new discovery agent |
| `workflow-editor/packages/codegen/src/generators/bubbleflow-generator.ts` | Context initialization and tracking |
| `apps/web/src/app/api/workflow/execute/route.ts` | Memory persistence after execution |
| `apps/web/src/lib/workflow-memory/memory-service.ts` | NEW - Memory service |
| `@bubblelab/bubble-core` (external) | AIAgentBubble + ContextDiscoveryAgentBubble |

---

# Example Workflow

```
[Webhook Trigger: "Write report on employee X"]
         ↓
[Context Discovery Agent]
  - Queries Gmail → Finds 3 relevant emails about performance review
  - Queries Slack → Finds discussion about concerns
  - Queries Memory → Finds last quarter's review workflow
  - Synthesizes: "HR manager requested this because of recent performance concerns
    discussed in email thread from Jan 5th and Slack #hr-reviews channel"
         ↓
[AI Agent: Analyze Data]
  - Receives full upstream context
  - Makes decisions, explains reasoning
  - Updates accumulatedSummary
         ↓
[AI Agent: Write Report]
  - Sees all previous context + decisions
  - Writes report with full understanding of WHY
         ↓
[Gmail: Send Report]
         ↓
[Save to Workflow Memory for future reference]
```

---

# Verification

1. **Execution Context**: Run workflow with 2+ AI agents, verify second agent sees first's decisions
2. **Context Discovery**: Trigger workflow, verify agent fetches relevant emails/docs and synthesizes context
3. **Memory**: Run similar workflow twice, verify second run can reference first run's decisions

---

# Open Questions

- What database will be used for workflow memory? (PostgreSQL with pgvector, Supabase, Pinecone, etc.)
- Should context discovery be automatic for all workflows or opt-in per workflow?
- How to handle authentication/credentials for data source queries in the discovery agent?
