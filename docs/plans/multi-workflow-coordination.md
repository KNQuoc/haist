# Plan: Multi-Workflow Coordination System

> **Status**: Draft - saved for future implementation
> **Created**: 2026-01-13
> **Related**: [Workflow Context & Decision Tracking](./workflow-context-decision-tracking.md)

## Vision
Enable entire departments to run on coordinated workflows - where workflows can trigger other workflows, share context, run in parallel, and communicate via events.

## Core Concepts

| Concept | Description | Example |
|---------|-------------|---------|
| **Workflow Bubble** | A bubble that executes another workflow | Support Triage workflow calls Escalation workflow |
| **Fan-out** | One output goes to multiple destinations | Ticket creates tasks for 3 different teams in parallel |
| **Fan-in** | Wait for multiple workflows, combine results | Wait for IT + HR + Manager approval, then proceed |
| **Department** | Collection of related workflows with shared context | "Customer Support" department with 5 interconnected workflows |
| **Event Bus** | Publish/subscribe for loose coupling | "ticket.resolved" event triggers satisfaction survey workflow |

---

# Part 1: Workflow Bubble (Workflow Composition)

## Goal
Allow workflows to call other workflows as if they were bubbles.

## New Bubble Type: `workflow`
**File:** `workflow-editor/packages/core/src/constants/bubble-registry.ts`

```typescript
'workflow': {
  name: 'workflow',
  className: 'WorkflowBubble',
  type: 'workflow',
  shortDescription: 'Execute another workflow',
  longDescription: 'Calls another workflow and returns its result. Enables workflow composition and reuse.',
  icon: 'git-branch',
  color: '#6366F1',
  schema: {
    workflowId: {
      name: 'workflowId',
      type: 'string',
      required: true,
      description: 'ID of the workflow to execute',
    },
    workflowName: {
      name: 'workflowName',
      type: 'string',
      required: false,
      description: 'Display name (for readability)',
    },
    payload: {
      name: 'payload',
      type: 'object',
      required: false,
      description: 'Input payload to pass to the workflow',
    },
    async: {
      name: 'async',
      type: 'boolean',
      required: false,
      default: false,
      description: 'If true, trigger workflow without waiting for result',
    },
    timeout: {
      name: 'timeout',
      type: 'number',
      required: false,
      default: 300000,
      description: 'Timeout in ms (default 5 minutes)',
    },
    inheritContext: {
      name: 'inheritContext',
      type: 'boolean',
      required: false,
      default: true,
      description: 'Pass current workflowContext to child workflow',
    },
  },
  resultSchema: {
    type: 'object',
    properties: {
      result: { type: 'unknown', description: 'Workflow execution result' },
      success: { type: 'boolean' },
      workflowExecutionId: { type: 'string' },
      error: { type: 'string' },
    },
  },
}
```

## Implementation
```typescript
export class WorkflowBubble extends BaseBubble {
  async action(): Promise<BubbleResult> {
    const { workflowId, payload, async, timeout, inheritContext } = this.config;

    // Build child payload with optional context inheritance
    const childPayload = {
      ...payload,
      parentContext: inheritContext ? this.workflowContext : undefined,
    };

    if (async) {
      // Fire and forget - return immediately
      const executionId = await this.triggerWorkflowAsync(workflowId, childPayload);
      return { success: true, data: { workflowExecutionId: executionId, async: true } };
    }

    // Synchronous - wait for result
    const result = await this.executeWorkflow(workflowId, childPayload, timeout);
    return {
      success: result.success,
      data: {
        result: result.data,
        workflowExecutionId: result.executionId,
      },
    };
  }
}
```

## Visual Editor Support
- New node type in the editor palette: "Workflow"
- Dropdown to select from available workflows
- Shows input/output schema of selected workflow
- Visual indicator showing it's a sub-workflow call

---

# Part 2: Fan-Out (Parallel Workflow Execution)

## Goal
One bubble output triggers multiple downstream workflows/bubbles in parallel.

## New Control Flow Node: `parallel`
```typescript
'parallel': {
  nodeType: 'control',
  controlType: 'parallel',
  description: 'Execute multiple branches in parallel, optionally wait for all to complete',
  schema: {
    waitForAll: {
      type: 'boolean',
      default: true,
      description: 'Wait for all branches to complete before continuing',
    },
    failFast: {
      type: 'boolean',
      default: false,
      description: 'If true, cancel other branches when one fails',
    },
    timeout: {
      type: 'number',
      default: 600000,
      description: 'Max time to wait for all branches (10 min default)',
    },
  },
}
```

## Visual Representation
```
        ┌─→ [Workflow A] ─┐
[Input] ─┼─→ [Workflow B] ─┼─→ [Merge Results]
        └─→ [Workflow C] ─┘
```

## Code Generation
```typescript
// Generated code for parallel execution
const parallelResults = await Promise.all([
  new WorkflowBubble({ workflowId: 'workflow-a', payload: input }).action(),
  new WorkflowBubble({ workflowId: 'workflow-b', payload: input }).action(),
  new WorkflowBubble({ workflowId: 'workflow-c', payload: input }).action(),
]);

// Merge into single context
workflowContext.parallelResults = {
  workflowA: parallelResults[0],
  workflowB: parallelResults[1],
  workflowC: parallelResults[2],
};
```

---

# Part 3: Fan-In (Join / Aggregate Results)

## Goal
Wait for multiple workflows to complete, then merge their results.

## New Control Flow Node: `join`
```typescript
'join': {
  nodeType: 'control',
  controlType: 'join',
  description: 'Wait for multiple incoming branches and merge results',
  schema: {
    mergeStrategy: {
      type: 'enum',
      enumValues: ['object', 'array', 'custom'],
      default: 'object',
      description: 'How to merge results from branches',
    },
    customMergeExpression: {
      type: 'string',
      required: false,
      description: 'Custom JS expression for merging (when strategy is "custom")',
    },
  },
}
```

## Use Case: Approval Workflow
```
[New Hire Request]
        ↓
    [Parallel]
   ↙    ↓    ↘
[IT]  [HR]  [Manager]
   ↘    ↓    ↙
    [Join: All Approved?]
        ↓
  [Proceed or Reject]
```

---

# Part 4: Event Bus (Pub/Sub Between Workflows)

## Goal
Loose coupling - workflows publish events, other workflows subscribe and react.

## Event Types
```typescript
export interface WorkflowEvent {
  id: string;
  type: string;                    // e.g., "ticket.resolved", "employee.onboarded"
  source: {
    workflowId: string;
    workflowName: string;
    executionId: string;
    nodeId: string;
  };
  payload: unknown;
  timestamp: string;
  department?: string;             // Optional department scope
}
```

## New Bubble: `event-publisher`
```typescript
'event-publisher': {
  name: 'event-publisher',
  className: 'EventPublisherBubble',
  type: 'service',
  shortDescription: 'Publish an event for other workflows to consume',
  schema: {
    eventType: {
      type: 'string',
      required: true,
      description: 'Event type (e.g., "ticket.resolved")',
    },
    payload: {
      type: 'object',
      required: true,
      description: 'Event data to publish',
    },
    department: {
      type: 'string',
      required: false,
      description: 'Limit event visibility to a department',
    },
  },
}
```

## New Trigger: `event/subscription`
```typescript
'event/subscription': {
  triggerType: 'event/subscription',
  description: 'Trigger workflow when a specific event is published',
  schema: {
    eventTypes: {
      type: 'array',
      required: true,
      description: 'Event types to subscribe to (e.g., ["ticket.*", "employee.onboarded"])',
    },
    filter: {
      type: 'object',
      required: false,
      description: 'Filter conditions on event payload',
    },
    department: {
      type: 'string',
      required: false,
      description: 'Only receive events from this department',
    },
  },
}
```

## Event Flow Example
```
[Support Workflow]
  - Resolves ticket
  - Publishes: { type: "ticket.resolved", payload: { ticketId, customerId, resolution } }

[Satisfaction Survey Workflow]
  - Subscribed to: "ticket.resolved"
  - Triggers automatically
  - Sends survey to customer

[Analytics Workflow]
  - Subscribed to: "ticket.*"
  - Tracks all ticket events for reporting
```

---

# Part 5: Department (Workflow Groups)

## Goal
Organize related workflows into departments with shared context and configuration.

## Department Schema
```typescript
export interface Department {
  id: string;
  name: string;                          // "Customer Support"
  description: string;
  workflows: string[];                   // Workflow IDs belonging to this department
  sharedContext: {
    variables: Record<string, unknown>;  // Shared variables accessible to all workflows
    credentials: string[];               // Shared credential IDs
    dataConnections: string[];           // Shared database/API connections
  };
  settings: {
    defaultTimeout: number;
    maxConcurrentExecutions: number;
    retryPolicy: RetryPolicy;
    alertChannels: string[];             // Slack channels for notifications
  };
  roles: DepartmentRole[];               // Who can edit/run/view workflows
}

export interface DepartmentRole {
  userId: string;
  role: 'owner' | 'editor' | 'operator' | 'viewer';
}
```

## Department Dashboard
Visual overview showing:
- All workflows in the department
- How they're connected (calls, events)
- Current execution status
- Recent runs and outcomes
- Health metrics

## Shared Context Access
```typescript
// In any workflow within a department:
const companyName = departmentContext.variables.companyName;
const supportEmail = departmentContext.variables.supportEmail;

// Shared credentials are automatically available
// e.g., all support workflows can use the shared Zendesk API key
```

---

# Part 6: Example - Support Escalation Department

## Workflows in Department

### 1. Ticket Triage Workflow
```
[Trigger: New Ticket via Webhook]
        ↓
[AI Agent: Analyze & Categorize]
  - Determines: priority, category, sentiment
  - Decides: can auto-resolve or needs human
        ↓
  [If auto-resolvable]
        ↓
[AI Agent: Generate Response]
        ↓
[Zendesk: Reply to Ticket]
        ↓
[Publish: "ticket.auto_resolved"]

  [If needs human]
        ↓
[Call: Assignment Workflow] ──→ passes ticket + context
```

### 2. Assignment Workflow
```
[Input: Ticket from Triage]
        ↓
[Query: Available Agents] (from shared PostgreSQL)
        ↓
[AI Agent: Match Best Agent]
  - Considers: skills, workload, past performance
        ↓
[Zendesk: Assign Ticket]
        ↓
[Slack: Notify Agent]
        ↓
[Publish: "ticket.assigned"]
```

### 3. Escalation Workflow
```
[Trigger: Event "ticket.stale" (no response in 2 hours)]
        ↓
[Query: Ticket Details]
        ↓
[AI Agent: Assess Urgency]
        ↓
  [If critical]
        ↓
    [Parallel]
   ↙         ↘
[Page Manager]  [Reassign to Senior]
   ↘         ↙
     [Join]
        ↓
[Publish: "ticket.escalated"]
```

### 4. Resolution Workflow
```
[Trigger: Ticket marked resolved in Zendesk]
        ↓
[AI Agent: Summarize Resolution]
  - Extracts: root cause, solution, time to resolve
        ↓
    [Parallel]
   ↙    ↓    ↘
[Update KB] [Log Metrics] [Call: Survey Workflow]
        ↓
[Publish: "ticket.resolved"]
```

### 5. Survey Workflow
```
[Input: Ticket + Customer info]
        ↓
[Wait: 24 hours]
        ↓
[Email: Send Satisfaction Survey]
        ↓
[Trigger: Survey Response Webhook]
        ↓
[AI Agent: Analyze Feedback]
        ↓
  [If negative]
        ↓
[Slack: Alert Support Lead]
```

## Visual Department Map
```
                    ┌──────────────────────────────────────────┐
                    │         SUPPORT DEPARTMENT               │
                    ├──────────────────────────────────────────┤
                    │                                          │
[New Ticket] ──→ [Triage] ──→ [Assignment] ──→ [Resolution]   │
                    │              ↑               │           │
                    │              │               ↓           │
                    │         [Escalation]    [Survey]         │
                    │              ↑               │           │
                    │              └───────────────┘           │
                    │                                          │
                    │  Shared: Zendesk creds, Slack channel,   │
                    │          PostgreSQL, Department context  │
                    └──────────────────────────────────────────┘
```

---

# Implementation Order

## Phase 1: Workflow Bubble (Foundation)
1. Add `workflow` bubble type to registry
2. Implement `WorkflowBubble` class
3. Add workflow selection UI in editor
4. Handle context inheritance between parent/child

## Phase 2: Parallel & Join
1. Add `parallel` control flow node
2. Add `join` control flow node
3. Update code generator for parallel execution
4. Add visual editor support for branching/merging

## Phase 3: Event Bus
1. Design event storage (Redis pub/sub, database, or message queue)
2. Add `event-publisher` bubble
3. Add `event/subscription` trigger type
4. Implement event routing and filtering

## Phase 4: Departments
1. Create department data model
2. Build department management UI
3. Implement shared context injection
4. Add department dashboard with workflow visualization

## Phase 5: Monitoring & Observability
1. Cross-workflow execution tracing
2. Department-level metrics
3. Alerting on failures
4. Workflow dependency visualization

---

# Critical Files

| File | Changes |
|------|---------|
| `workflow-editor/packages/core/src/types/node.types.ts` | New control flow nodes (parallel, join) |
| `workflow-editor/packages/core/src/constants/bubble-registry.ts` | Workflow bubble, event-publisher |
| `workflow-editor/packages/core/src/constants/triggers.ts` | Event subscription trigger |
| `workflow-editor/packages/codegen/src/generators/bubbleflow-generator.ts` | Parallel execution, workflow calls |
| `apps/web/src/lib/events/event-bus.ts` | NEW - Event pub/sub system |
| `apps/web/src/lib/departments/department-service.ts` | NEW - Department management |
| `@bubblelab/bubble-core` | WorkflowBubble, EventPublisherBubble |

---

# Database Schema Additions

```sql
-- Departments
CREATE TABLE departments (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  settings JSONB,
  shared_context JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Department membership
CREATE TABLE department_workflows (
  department_id UUID REFERENCES departments(id),
  workflow_id TEXT NOT NULL,
  PRIMARY KEY (department_id, workflow_id)
);

-- Events for pub/sub
CREATE TABLE workflow_events (
  id UUID PRIMARY KEY,
  type TEXT NOT NULL,
  source JSONB NOT NULL,
  payload JSONB,
  department_id UUID REFERENCES departments(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_events_type ON workflow_events(type);
CREATE INDEX idx_events_department ON workflow_events(department_id);

-- Event subscriptions
CREATE TABLE event_subscriptions (
  id UUID PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  event_patterns TEXT[] NOT NULL,  -- e.g., ["ticket.*", "employee.onboarded"]
  filter JSONB,
  department_id UUID REFERENCES departments(id),
  is_active BOOLEAN DEFAULT true
);
```

---

# Open Questions

1. **Event delivery guarantees**: At-least-once or exactly-once? Need dead letter queue?
2. **Workflow versioning**: How to handle when a child workflow is updated mid-execution?
3. **Cross-department calls**: Should workflows be able to call workflows in other departments?
4. **Billing/quotas**: How to track usage across department workflows?
5. **Testing**: How to test a full department workflow end-to-end?
