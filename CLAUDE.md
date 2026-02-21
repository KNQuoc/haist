# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Blockd4 is a workflow automation platform with two main components:
- **workflow-editor/** - Turborepo monorepo: Next.js visual workflow editor for BubbleLab
- **blockd/** - Standalone Node.js CLI app for executing BubbleLab workflows

## Development Commands

### workflow-editor (monorepo root)
```bash
cd workflow-editor
pnpm install          # Install all dependencies
pnpm dev              # Run dev for all packages (Turbo)
pnpm build            # Build all packages
pnpm typecheck        # Type check all packages
pnpm lint             # Lint all packages
pnpm format           # Prettier format
pnpm clean            # Clean builds and node_modules

# Target specific package
pnpm --filter web dev                        # Run web app only
pnpm --filter @workflow-editor/core build    # Build specific package
```

### blockd (standalone CLI)
```bash
cd blockd
npm run dev           # Run with tsx (hot reload)
npm run build         # Compile TypeScript
npm start             # Run compiled code
npm run typecheck     # Type check
```

## Architecture

### Monorepo Package Structure (workflow-editor/packages/)
Build order follows dependency graph:
1. **@workflow-editor/core** - Types, constants, bubble registry (no deps)
2. **@workflow-editor/state** - Zustand stores (depends on core)
3. **@workflow-editor/canvas** - ReactFlow wrapper (depends on core, state)
4. **@workflow-editor/nodes** - Node components (depends on core, state)
5. **@workflow-editor/codegen** - TypeScript code generation (depends on core)
6. **@workflow-editor/ui** - Shared UI components (depends on core, codegen, state)

### Web App Structure (workflow-editor/apps/web/src/)
```
app/
├── api/                    # API routes
│   ├── ai-assistant/       # Claude-powered workflow generation
│   ├── auth/               # Better Auth endpoints
│   ├── workflows/          # Workflow CRUD + execution
│   └── composio/           # Third-party tool integration
├── editor/                 # Main workflow editor page
└── ai-assistant/           # AI workflow generator page

lib/
├── ai-assistant/           # Core AI workflow generation logic
│   ├── workflow-ai-service.ts      # Main chat service with Claude
│   ├── workflow-generator.ts       # Converts AI responses to visual workflows
│   ├── bubble-context-builder.ts   # Context builder for available bubbles
│   └── prompts.ts                  # System prompts and few-shot examples
└── auth.ts                 # Auth client configuration
```

### State Management
Zustand stores in `@workflow-editor/state/src/stores/`:
- **workflow-store** - Nodes, edges, metadata, trigger config
- **canvas-store** - Viewport, grid, minimap, interaction mode
- **selection-store** - Selected nodes/edges, hover state
- **history-store** - Undo/redo stack
- **ui-store** - Panel visibility, tabs, dialogs

### Code Generation Pipeline
`@workflow-editor/codegen/src/generators/bubbleflow-generator.ts`:
```
Visual Workflow Graph → Topological Sort → AST Generation → TypeScript BubbleFlow class
```

## Key Technologies

- **Next.js 15** with App Router and Server Components
- **ReactFlow (@xyflow/react)** for visual canvas
- **Zustand** for state management
- **Better Auth + Supabase** for authentication
- **Claude API (@anthropic-ai/sdk)** for AI workflow generation
- **Composio** for third-party tool integrations
- **pnpm** with Turborepo for monorepo management

## Environment Variables (apps/web)

Required in `workflow-editor/apps/web/.env`:
```
BETTER_AUTH_SECRET=
DATABASE_URL=postgresql://...
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
GOOGLE_API_KEY=
COMPOSIO_API_KEY=
```
