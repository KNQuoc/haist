# BetterAuth + Supabase Integration Plan

## Overview

Integrate BetterAuth authentication with Supabase PostgreSQL database for the workflow-editor application, enabling OAuth login (Google, GitHub) and migrating workflow data from local Docker PostgreSQL to Supabase.

## Current State

### workflow-editor (apps/web)
- **Framework**: Next.js 15.1.3 with App Router
- **Database**: Local Docker PostgreSQL (`blockd3`) via `pg` driver
- **Auth**: None - uses hardcoded `DEFAULT_USER_ID`
- **Supabase SDK**: Installed (`@supabase/supabase-js`) but not used
- **Tables**: `Workflow`, `Execution` (simple schema)

### blockd
- **Type**: Standalone AI agent (BubbleLab)
- **Database**: None (stateless)
- **Supabase**: Credentials configured in `.env` but not used

## Target Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    workflow-editor (Next.js)                 │
├─────────────────────────────────────────────────────────────┤
│  /api/auth/[...all]  ←── BetterAuth Handler                 │
│  /api/workflows/*    ←── Workflow CRUD (authenticated)      │
│  /                   ←── Dashboard (protected)              │
│  /editor/*           ←── Workflow Editor (protected)        │
│  /login              ←── Login page (public)                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Supabase PostgreSQL                        │
├─────────────────────────────────────────────────────────────┤
│  BetterAuth Tables:                                         │
│  ├── user (id, name, email, emailVerified, image, ...)      │
│  ├── session (id, userId, token, expiresAt, ...)            │
│  ├── account (id, userId, providerId, accessToken, ...)     │
│  └── verification (id, identifier, value, expiresAt, ...)   │
│                                                             │
│  Application Tables:                                        │
│  ├── workflow (id, userId, name, nodes, edges, ...)         │
│  └── execution (id, workflowId, userId, status, ...)        │
└─────────────────────────────────────────────────────────────┘
```

## Implementation Phases

---

## Phase 1: BetterAuth Setup

### 1.1 Install Dependencies

```bash
cd workflow-editor/apps/web
pnpm add better-auth
```

### 1.2 Create Auth Configuration

**File: `apps/web/src/lib/auth.ts`**

```typescript
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { Pool } from "pg";

export const auth = betterAuth({
  database: new Pool({
    connectionString: process.env.DATABASE_URL,
  }),

  emailAndPassword: {
    enabled: false, // Only OAuth for now
  },

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
  },

  plugins: [nextCookies()],
});
```

### 1.3 Create Auth Client

**File: `apps/web/src/lib/auth-client.ts`**

```typescript
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient();

export const { signIn, signOut, useSession } = authClient;
```

### 1.4 Create Auth API Route

**File: `apps/web/src/app/api/auth/[...all]/route.ts`**

```typescript
import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { GET, POST } = toNextJsHandler(auth);
```

### 1.5 Environment Variables

**Add to `.env.local`:**

```env
# BetterAuth
BETTER_AUTH_SECRET=<generate-with-openssl-rand-base64-32>
BETTER_AUTH_URL=http://localhost:3000

# Supabase PostgreSQL (Direct Connection)
DATABASE_URL=postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres

# OAuth Providers
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
```

---

## Phase 2: Database Migration

### 2.1 Run BetterAuth Migration

```bash
cd workflow-editor/apps/web
npx @better-auth/cli migrate
```

This creates BetterAuth tables: `user`, `session`, `account`, `verification`

### 2.2 Create Application Tables Migration

**File: `migrations/001_create_workflow_tables.sql`**

```sql
-- Workflow table
CREATE TABLE IF NOT EXISTS workflow (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  nodes JSONB DEFAULT '[]'::jsonb,
  edges JSONB DEFAULT '[]'::jsonb,
  settings JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Execution table
CREATE TABLE IF NOT EXISTS execution (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL REFERENCES workflow(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'RUNNING', 'SUCCESS', 'FAILED')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  input JSONB,
  output JSONB,
  error TEXT
);

-- Indexes
CREATE INDEX idx_workflow_user_id ON workflow(user_id);
CREATE INDEX idx_execution_workflow_id ON execution(workflow_id);
CREATE INDEX idx_execution_user_id ON execution(user_id);
CREATE INDEX idx_execution_status ON execution(status);

-- Auto-update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_workflow_updated_at
  BEFORE UPDATE ON workflow
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
```

### 2.3 Update Storage Layer

**File: `apps/web/src/app/api/workflows/storage.ts`**

Update to use Supabase connection and real user IDs:

```typescript
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Remove DEFAULT_USER_ID - will get from session
```

---

## Phase 3: Auth UI Components

### 3.1 Login Page

**File: `apps/web/src/app/login/page.tsx`**

```typescript
'use client';

import { signIn } from '@/lib/auth-client';

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="space-y-4">
        <h1>Sign in to Workflow Editor</h1>
        <button onClick={() => signIn.social({ provider: 'google' })}>
          Continue with Google
        </button>
        <button onClick={() => signIn.social({ provider: 'github' })}>
          Continue with GitHub
        </button>
      </div>
    </div>
  );
}
```

### 3.2 Auth Provider Wrapper

**File: `apps/web/src/components/auth/AuthProvider.tsx`**

```typescript
'use client';

import { useSession } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!isPending && !session) {
      router.push('/login');
    }
  }, [session, isPending, router]);

  if (isPending) return <div>Loading...</div>;
  if (!session) return null;

  return <>{children}</>;
}
```

---

## Phase 4: Protected Routes & API Updates

### 4.1 Update Workflow API Routes

All workflow API routes need to:
1. Get session from BetterAuth
2. Use `session.user.id` instead of `DEFAULT_USER_ID`
3. Filter workflows by authenticated user

**Example: `apps/web/src/app/api/workflows/route.ts`**

```typescript
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

export async function GET() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const workflows = await workflowsStorage.getByUserId(session.user.id);
  return NextResponse.json(workflows);
}
```

### 4.2 Protect Dashboard and Editor

**File: `apps/web/src/app/page.tsx`**

```typescript
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Dashboard } from '@/components/dashboard/Dashboard';

export default async function Home() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect('/login');
  }

  return <Dashboard />;
}
```

---

## Phase 5: Data Migration (Local Docker → Supabase)

### 5.1 Migration Script

**File: `scripts/migrate-workflows.ts`**

```typescript
import { Pool } from 'pg';

const sourcePool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'blockd3',
  user: 'blockd3',
  password: 'blockd3_dev_password',
});

const targetPool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function migrateWorkflows(newUserId: string) {
  // Get all workflows from local DB
  const { rows: workflows } = await sourcePool.query(
    'SELECT * FROM "Workflow"'
  );

  // Insert into Supabase with new user ID
  for (const workflow of workflows) {
    await targetPool.query(
      `INSERT INTO workflow (id, user_id, name, description, nodes, edges, settings, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        workflow.id,
        newUserId, // Replace old userId with authenticated user
        workflow.name,
        workflow.description,
        JSON.stringify(workflow.nodes),
        JSON.stringify(workflow.edges),
        JSON.stringify(workflow.settings),
        workflow.isActive,
        workflow.createdAt,
        workflow.updatedAt,
      ]
    );
  }
}
```

---

## Phase 6: OAuth Provider Setup

### 6.1 Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create OAuth 2.0 Client ID
3. Add authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
4. Copy Client ID and Secret to `.env.local`

### 6.2 GitHub OAuth Setup

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Create new OAuth App
3. Set callback URL: `http://localhost:3000/api/auth/callback/github`
4. Copy Client ID and Secret to `.env.local`

---

## File Changes Summary

### New Files
- `apps/web/src/lib/auth.ts` - BetterAuth server config
- `apps/web/src/lib/auth-client.ts` - BetterAuth client
- `apps/web/src/app/api/auth/[...all]/route.ts` - Auth API handler
- `apps/web/src/app/login/page.tsx` - Login page
- `apps/web/src/components/auth/AuthProvider.tsx` - Auth wrapper
- `migrations/001_create_workflow_tables.sql` - Supabase migration
- `scripts/migrate-workflows.ts` - Data migration script

### Modified Files
- `apps/web/src/app/api/workflows/storage.ts` - Update DB connection
- `apps/web/src/app/api/workflows/route.ts` - Add auth check
- `apps/web/src/app/api/workflows/[id]/route.ts` - Add auth check
- `apps/web/src/app/api/workflows/[id]/execute/route.ts` - Add auth check
- `apps/web/src/app/api/workflows/[id]/executions/route.ts` - Add auth check
- `apps/web/src/app/api/workflows/[id]/duplicate/route.ts` - Add auth check
- `apps/web/src/app/page.tsx` - Add auth protection
- `apps/web/src/app/editor/page.tsx` - Add auth protection
- `apps/web/src/app/editor/[workflowId]/page.tsx` - Add auth protection
- `apps/web/.env.local` - Add new env vars

---

## Implementation Order

1. **Phase 1**: BetterAuth setup (auth.ts, auth-client.ts, API route)
2. **Phase 2**: Database migration (BetterAuth CLI, application tables)
3. **Phase 3**: Auth UI (login page, provider wrapper)
4. **Phase 4**: Protected routes (update all API routes and pages)
5. **Phase 5**: Data migration (migrate existing workflows)
6. **Phase 6**: OAuth setup (Google, GitHub credentials)

---

## Testing Checklist

- [ ] BetterAuth tables created in Supabase
- [ ] Application tables created in Supabase
- [ ] Google OAuth login works
- [ ] GitHub OAuth login works
- [ ] Session persists across page refreshes
- [ ] Unauthenticated users redirected to /login
- [ ] Workflows are scoped to authenticated user
- [ ] Creating new workflow works
- [ ] Editing workflow works
- [ ] Deleting workflow works
- [ ] Existing workflows migrated successfully
