/**
 * PostgreSQL storage for execution logs
 *
 * SQL Migration:
 *
 * -- Supabase (snake_case):
 * CREATE TABLE execution_log (
 *   id TEXT PRIMARY KEY,
 *   rule_id TEXT NOT NULL,
 *   rule_name TEXT NOT NULL,
 *   user_id TEXT NOT NULL,
 *   trigger_slug TEXT NOT NULL,
 *   status TEXT NOT NULL CHECK (status IN ('success', 'failure', 'partial')),
 *   steps_json JSONB,
 *   output_text TEXT,
 *   error_text TEXT,
 *   duration_ms INTEGER,
 *   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
 * );
 * CREATE INDEX idx_execution_log_user_id ON execution_log(user_id);
 * CREATE INDEX idx_execution_log_rule_id ON execution_log(rule_id);
 * CREATE INDEX idx_execution_log_created_at ON execution_log(created_at);
 *
 * -- Local Docker (PascalCase):
 * CREATE TABLE "ExecutionLog" (
 *   id TEXT PRIMARY KEY,
 *   "ruleId" TEXT NOT NULL,
 *   "ruleName" TEXT NOT NULL,
 *   "userId" TEXT NOT NULL,
 *   "triggerSlug" TEXT NOT NULL,
 *   status TEXT NOT NULL CHECK (status IN ('success', 'failure', 'partial')),
 *   "stepsJson" JSONB,
 *   "outputText" TEXT,
 *   "errorText" TEXT,
 *   "durationMs" INTEGER,
 *   "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
 * );
 * CREATE INDEX "idx_ExecutionLog_userId" ON "ExecutionLog"("userId");
 * CREATE INDEX "idx_ExecutionLog_ruleId" ON "ExecutionLog"("ruleId");
 * CREATE INDEX "idx_ExecutionLog_createdAt" ON "ExecutionLog"("createdAt");
 */

import { pool } from '@/lib/db';
import type { ExecutionLogEntry, ExecutionLogStats } from './types';

const isSupabase = !!process.env.DATABASE_URL;
const LOG_TABLE = isSupabase ? 'execution_log' : '"ExecutionLog"';

const col = {
  ruleId: isSupabase ? 'rule_id' : '"ruleId"',
  ruleName: isSupabase ? 'rule_name' : '"ruleName"',
  userId: isSupabase ? 'user_id' : '"userId"',
  triggerSlug: isSupabase ? 'trigger_slug' : '"triggerSlug"',
  stepsJson: isSupabase ? 'steps_json' : '"stepsJson"',
  outputText: isSupabase ? 'output_text' : '"outputText"',
  errorText: isSupabase ? 'error_text' : '"errorText"',
  durationMs: isSupabase ? 'duration_ms' : '"durationMs"',
  createdAt: isSupabase ? 'created_at' : '"createdAt"',
};

function mapLogRow(row: Record<string, unknown>): ExecutionLogEntry {
  const ruleId = row.ruleId || row.rule_id;
  const ruleName = row.ruleName || row.rule_name;
  const userId = row.userId || row.user_id;
  const triggerSlug = row.triggerSlug || row.trigger_slug;
  const stepsJson = row.stepsJson || row.steps_json;
  const outputText = row.outputText || row.output_text;
  const errorText = row.errorText || row.error_text;
  const durationMs = row.durationMs ?? row.duration_ms;
  const createdAt = row.createdAt || row.created_at;

  return {
    id: row.id as string,
    ruleId: ruleId as string,
    ruleName: ruleName as string,
    userId: userId as string,
    triggerSlug: triggerSlug as string,
    status: row.status as 'success' | 'failure' | 'partial',
    stepsJson: (stepsJson as ExecutionLogEntry['stepsJson']) || [],
    outputText: (outputText as string) || undefined,
    errorText: (errorText as string) || undefined,
    durationMs: (durationMs as number) || undefined,
    createdAt: createdAt instanceof Date ? createdAt.toISOString() : String(createdAt),
  };
}

function generateId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 15);
  return `log_${timestamp}${randomPart}`;
}

export const executionLogStorage = {
  async create(log: Omit<ExecutionLogEntry, 'id' | 'createdAt'>): Promise<ExecutionLogEntry> {
    const id = generateId();
    await pool.query(
      `INSERT INTO ${LOG_TABLE}
       (id, ${col.ruleId}, ${col.ruleName}, ${col.userId}, ${col.triggerSlug},
        status, ${col.stepsJson}, ${col.outputText}, ${col.errorText}, ${col.durationMs}, ${col.createdAt})
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`,
      [
        id,
        log.ruleId,
        log.ruleName,
        log.userId,
        log.triggerSlug,
        log.status,
        JSON.stringify(log.stepsJson || []),
        log.outputText || null,
        log.errorText || null,
        log.durationMs || null,
      ]
    );

    const result = await pool.query(`SELECT * FROM ${LOG_TABLE} WHERE id = $1`, [id]);
    return mapLogRow(result.rows[0]);
  },

  async getByRuleId(ruleId: string, limit = 50, offset = 0): Promise<{ logs: ExecutionLogEntry[]; total: number }> {
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM ${LOG_TABLE} WHERE ${col.ruleId} = $1`,
      [ruleId]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await pool.query(
      `SELECT * FROM ${LOG_TABLE} WHERE ${col.ruleId} = $1 ORDER BY ${col.createdAt} DESC LIMIT $2 OFFSET $3`,
      [ruleId, limit, offset]
    );

    return { logs: result.rows.map(mapLogRow), total };
  },

  async getByUserId(userId: string, limit = 50, offset = 0): Promise<{ logs: ExecutionLogEntry[]; total: number }> {
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM ${LOG_TABLE} WHERE ${col.userId} = $1`,
      [userId]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await pool.query(
      `SELECT * FROM ${LOG_TABLE} WHERE ${col.userId} = $1 ORDER BY ${col.createdAt} DESC LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return { logs: result.rows.map(mapLogRow), total };
  },

  async getRecent(userId: string, limit = 10): Promise<ExecutionLogEntry[]> {
    const result = await pool.query(
      `SELECT * FROM ${LOG_TABLE} WHERE ${col.userId} = $1 ORDER BY ${col.createdAt} DESC LIMIT $2`,
      [userId, limit]
    );
    return result.rows.map(mapLogRow);
  },

  async deleteOlderThan(days: number): Promise<number> {
    const result = await pool.query(
      `DELETE FROM ${LOG_TABLE} WHERE ${col.createdAt} < NOW() - INTERVAL '1 day' * $1 RETURNING id`,
      [days]
    );
    return result.rows.length;
  },

  async getStats(userId: string): Promise<ExecutionLogStats> {
    const result = await pool.query(
      `SELECT
         COUNT(*) as total_runs,
         COUNT(*) FILTER (WHERE status = 'success') as success_count,
         AVG(${col.durationMs}) as avg_duration_ms
       FROM ${LOG_TABLE}
       WHERE ${col.userId} = $1`,
      [userId]
    );

    const row = result.rows[0];
    const totalRuns = parseInt(row.total_runs, 10) || 0;
    const successCount = parseInt(row.success_count, 10) || 0;

    return {
      totalRuns,
      successRate: totalRuns > 0 ? (successCount / totalRuns) * 100 : 0,
      avgDurationMs: row.avg_duration_ms ? Math.round(parseFloat(row.avg_duration_ms)) : 0,
    };
  },

  async getStatsByRuleId(ruleId: string): Promise<ExecutionLogStats> {
    const result = await pool.query(
      `SELECT
         COUNT(*) as total_runs,
         COUNT(*) FILTER (WHERE status = 'success') as success_count,
         AVG(${col.durationMs}) as avg_duration_ms
       FROM ${LOG_TABLE}
       WHERE ${col.ruleId} = $1`,
      [ruleId]
    );

    const row = result.rows[0];
    const totalRuns = parseInt(row.total_runs, 10) || 0;
    const successCount = parseInt(row.success_count, 10) || 0;

    return {
      totalRuns,
      successRate: totalRuns > 0 ? (successCount / totalRuns) * 100 : 0,
      avgDurationMs: row.avg_duration_ms ? Math.round(parseFloat(row.avg_duration_ms)) : 0,
    };
  },
};
