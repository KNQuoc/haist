/**
 * PostgreSQL storage for execution rules
 * Follows the pattern from /app/api/workflows/storage.ts
 */

import { pool } from '@/lib/db';
import type {
  ExecutionRule,
  ExecutionRuleInput,
  ExecutionStep,
  OutputConfig,
  ActivationMode,
  ScheduleInterval,
} from './types';

// Detect table naming convention (Supabase uses lowercase, local Docker uses PascalCase)
const isSupabase = !!process.env.DATABASE_URL;
const RULE_TABLE = isSupabase ? 'execution_rule' : '"ExecutionRule"';

// Column name helpers (Supabase uses snake_case, local uses camelCase)
const col = {
  userId: isSupabase ? 'user_id' : '"userId"',
  isActive: isSupabase ? 'is_active' : '"isActive"',
  acceptedTriggers: isSupabase ? 'accepted_triggers' : '"acceptedTriggers"',
  topicCondition: isSupabase ? 'topic_condition' : '"topicCondition"',
  executionSteps: isSupabase ? 'execution_steps' : '"executionSteps"',
  outputConfig: isSupabase ? 'output_config' : '"outputConfig"',
  executionCount: isSupabase ? 'execution_count' : '"executionCount"',
  lastExecutedAt: isSupabase ? 'last_executed_at' : '"lastExecutedAt"',
  createdAt: isSupabase ? 'created_at' : '"createdAt"',
  updatedAt: isSupabase ? 'updated_at' : '"updatedAt"',
  // Activation mode columns
  activationMode: isSupabase ? 'activation_mode' : '"activationMode"',
  scheduleEnabled: isSupabase ? 'schedule_enabled' : '"scheduleEnabled"',
  scheduleInterval: isSupabase ? 'schedule_interval' : '"scheduleInterval"',
  scheduleLastRun: isSupabase ? 'schedule_last_run' : '"scheduleLastRun"',
  scheduleNextRun: isSupabase ? 'schedule_next_run' : '"scheduleNextRun"',
};

/**
 * Execution rules storage operations
 */
export const executionRulesStorage = {
  /**
   * Get all rules for a user
   */
  async getByUserId(userId: string): Promise<ExecutionRule[]> {
    const result = await pool.query(
      `SELECT * FROM ${RULE_TABLE} WHERE ${col.userId} = $1 ORDER BY priority DESC, ${col.updatedAt} DESC`,
      [userId]
    );
    return result.rows.map(mapRuleRow);
  },

  /**
   * Get active rules for a user (sorted by priority DESC)
   */
  async getActiveByUserId(userId: string): Promise<ExecutionRule[]> {
    const result = await pool.query(
      `SELECT * FROM ${RULE_TABLE} WHERE ${col.userId} = $1 AND ${col.isActive} = true ORDER BY priority DESC`,
      [userId]
    );
    return result.rows.map(mapRuleRow);
  },

  /**
   * Get a specific rule by ID
   */
  async get(id: string): Promise<ExecutionRule | undefined> {
    const result = await pool.query(
      `SELECT * FROM ${RULE_TABLE} WHERE id = $1`,
      [id]
    );
    if (result.rows.length === 0) return undefined;
    return mapRuleRow(result.rows[0]);
  },

  /**
   * Create a new rule
   */
  async create(userId: string, input: ExecutionRuleInput): Promise<ExecutionRule> {
    const id = generateId('rule');
    const scheduleNextRun = input.scheduleEnabled && input.scheduleInterval
      ? calculateNextRunTime(input.scheduleInterval)
      : null;

    await pool.query(
      `INSERT INTO ${RULE_TABLE}
       (id, ${col.userId}, name, description, ${col.isActive}, priority,
        ${col.acceptedTriggers}, ${col.topicCondition}, ${col.executionSteps},
        ${col.outputConfig}, ${col.executionCount}, ${col.createdAt}, ${col.updatedAt},
        ${col.activationMode}, ${col.scheduleEnabled}, ${col.scheduleInterval}, ${col.scheduleNextRun})
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0, NOW(), NOW(), $11, $12, $13, $14)`,
      [
        id,
        userId,
        input.name,
        input.description || null,
        input.isActive ?? true,
        input.priority ?? 0,
        JSON.stringify(input.acceptedTriggers || []),
        input.topicCondition,
        JSON.stringify(input.executionSteps),
        JSON.stringify(input.outputConfig),
        input.activationMode ?? 'trigger',
        input.scheduleEnabled ?? false,
        input.scheduleInterval || null,
        scheduleNextRun,
      ]
    );

    const created = await this.get(id);
    if (!created) throw new Error('Failed to create execution rule');
    return created;
  },

  /**
   * Update an existing rule
   */
  async update(id: string, input: Partial<ExecutionRuleInput>): Promise<ExecutionRule | undefined> {
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (input.name !== undefined) {
      setClauses.push(`name = $${paramIndex++}`);
      values.push(input.name);
    }
    if (input.description !== undefined) {
      setClauses.push(`description = $${paramIndex++}`);
      values.push(input.description);
    }
    if (input.isActive !== undefined) {
      setClauses.push(`${col.isActive} = $${paramIndex++}`);
      values.push(input.isActive);
    }
    if (input.priority !== undefined) {
      setClauses.push(`priority = $${paramIndex++}`);
      values.push(input.priority);
    }
    if (input.acceptedTriggers !== undefined) {
      setClauses.push(`${col.acceptedTriggers} = $${paramIndex++}`);
      values.push(JSON.stringify(input.acceptedTriggers));
    }
    if (input.topicCondition !== undefined) {
      setClauses.push(`${col.topicCondition} = $${paramIndex++}`);
      values.push(input.topicCondition);
    }
    if (input.executionSteps !== undefined) {
      setClauses.push(`${col.executionSteps} = $${paramIndex++}`);
      values.push(JSON.stringify(input.executionSteps));
    }
    if (input.outputConfig !== undefined) {
      setClauses.push(`${col.outputConfig} = $${paramIndex++}`);
      values.push(JSON.stringify(input.outputConfig));
    }
    // Activation mode fields
    if (input.activationMode !== undefined) {
      setClauses.push(`${col.activationMode} = $${paramIndex++}`);
      values.push(input.activationMode);
    }
    if (input.scheduleEnabled !== undefined) {
      setClauses.push(`${col.scheduleEnabled} = $${paramIndex++}`);
      values.push(input.scheduleEnabled);
    }
    if (input.scheduleInterval !== undefined) {
      setClauses.push(`${col.scheduleInterval} = $${paramIndex++}`);
      values.push(input.scheduleInterval);
      // Recalculate next run time when interval changes
      if (input.scheduleEnabled !== false && input.scheduleInterval) {
        setClauses.push(`${col.scheduleNextRun} = $${paramIndex++}`);
        values.push(calculateNextRunTime(input.scheduleInterval));
      }
    }

    if (setClauses.length === 0) {
      return this.get(id);
    }

    values.push(id);
    await pool.query(
      `UPDATE ${RULE_TABLE} SET ${setClauses.join(', ')} WHERE id = $${paramIndex}`,
      values
    );

    return this.get(id);
  },

  /**
   * Delete a rule
   */
  async delete(id: string): Promise<boolean> {
    const result = await pool.query(
      `DELETE FROM ${RULE_TABLE} WHERE id = $1 RETURNING id`,
      [id]
    );
    return result.rows.length > 0;
  },

  /**
   * Check if a user has any active rules
   */
  async hasActiveRules(userId: string): Promise<boolean> {
    const result = await pool.query(
      `SELECT 1 FROM ${RULE_TABLE} WHERE ${col.userId} = $1 AND ${col.isActive} = true LIMIT 1`,
      [userId]
    );
    return result.rows.length > 0;
  },

  /**
   * Increment execution count and update last executed timestamp
   */
  async incrementExecutionCount(id: string): Promise<void> {
    await pool.query(
      `UPDATE ${RULE_TABLE}
       SET ${col.executionCount} = ${col.executionCount} + 1, ${col.lastExecutedAt} = NOW()
       WHERE id = $1`,
      [id]
    );
  },

  /**
   * Get rules available for manual invocation by a user
   * Returns rules with activation_mode = 'manual' or 'all'
   */
  async getManualRules(userId: string): Promise<ExecutionRule[]> {
    const result = await pool.query(
      `SELECT * FROM ${RULE_TABLE}
       WHERE ${col.userId} = $1
       AND ${col.isActive} = true
       AND (${col.activationMode} = 'manual' OR ${col.activationMode} = 'all')
       ORDER BY priority DESC, name ASC`,
      [userId]
    );
    return result.rows.map(mapRuleRow);
  },

  /**
   * Get scheduled rules that are due to run
   * Returns rules where schedule_enabled = true AND schedule_next_run <= NOW()
   */
  async getScheduledRulesDue(): Promise<ExecutionRule[]> {
    const result = await pool.query(
      `SELECT * FROM ${RULE_TABLE}
       WHERE ${col.scheduleEnabled} = true
       AND ${col.scheduleNextRun} <= NOW()
       AND ${col.isActive} = true
       AND (${col.activationMode} = 'scheduled' OR ${col.activationMode} = 'all')
       ORDER BY ${col.scheduleNextRun} ASC`
    );
    return result.rows.map(mapRuleRow);
  },

  /**
   * Update schedule timestamps after a scheduled run
   */
  async updateScheduleRun(id: string, interval: ScheduleInterval): Promise<void> {
    const nextRun = calculateNextRunTime(interval);
    await pool.query(
      `UPDATE ${RULE_TABLE}
       SET ${col.scheduleLastRun} = NOW(),
           ${col.scheduleNextRun} = $2,
           ${col.executionCount} = ${col.executionCount} + 1,
           ${col.lastExecutedAt} = NOW()
       WHERE id = $1`,
      [id, nextRun]
    );
  },

  /**
   * Get a rule by ID and user (for manual invocation validation)
   */
  async getByIdAndUser(id: string, userId: string): Promise<ExecutionRule | undefined> {
    const result = await pool.query(
      `SELECT * FROM ${RULE_TABLE} WHERE id = $1 AND ${col.userId} = $2`,
      [id, userId]
    );
    if (result.rows.length === 0) return undefined;
    return mapRuleRow(result.rows[0]);
  },
};

/**
 * Map database row to ExecutionRule
 */
function mapRuleRow(row: Record<string, unknown>): ExecutionRule {
  const userId = row.userId || row.user_id;
  const isActive = row.isActive ?? row.is_active;
  const acceptedTriggers = row.acceptedTriggers || row.accepted_triggers;
  const topicCondition = row.topicCondition || row.topic_condition;
  const executionSteps = row.executionSteps || row.execution_steps;
  const outputConfig = row.outputConfig || row.output_config;
  const executionCount = row.executionCount ?? row.execution_count;
  const lastExecutedAt = row.lastExecutedAt || row.last_executed_at;
  const createdAt = row.createdAt || row.created_at;
  const updatedAt = row.updatedAt || row.updated_at;
  // Activation mode fields
  const activationMode = row.activationMode || row.activation_mode;
  const scheduleEnabled = row.scheduleEnabled ?? row.schedule_enabled;
  const scheduleInterval = row.scheduleInterval || row.schedule_interval;
  const scheduleLastRun = row.scheduleLastRun || row.schedule_last_run;
  const scheduleNextRun = row.scheduleNextRun || row.schedule_next_run;

  return {
    id: row.id as string,
    userId: userId as string,
    name: row.name as string,
    description: row.description as string | undefined,
    isActive: Boolean(isActive),
    priority: (row.priority as number) || 0,
    acceptedTriggers: (acceptedTriggers as string[]) || [],
    topicCondition: topicCondition as string,
    executionSteps: (executionSteps as ExecutionStep[]) || [],
    outputConfig: (outputConfig as OutputConfig) || { platform: 'none', format: 'summary' },
    executionCount: (executionCount as number) || 0,
    lastExecutedAt: lastExecutedAt instanceof Date
      ? lastExecutedAt.toISOString()
      : (lastExecutedAt as string | undefined),
    createdAt: createdAt instanceof Date ? createdAt.toISOString() : String(createdAt),
    updatedAt: updatedAt instanceof Date ? updatedAt.toISOString() : String(updatedAt),
    // Activation mode fields
    activationMode: (activationMode as ActivationMode) || 'trigger',
    scheduleEnabled: Boolean(scheduleEnabled),
    scheduleInterval: scheduleInterval as ScheduleInterval | undefined,
    scheduleLastRun: scheduleLastRun instanceof Date
      ? scheduleLastRun.toISOString()
      : (scheduleLastRun as string | undefined),
    scheduleNextRun: scheduleNextRun instanceof Date
      ? scheduleNextRun.toISOString()
      : (scheduleNextRun as string | undefined),
  };
}

/**
 * Generate unique ID (CUID-like format)
 */
function generateId(prefix: string = ''): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 15);
  return prefix ? `${prefix}_${timestamp}${randomPart}` : `c${timestamp}${randomPart}`;
}

/**
 * Calculate next run time based on schedule interval
 */
function calculateNextRunTime(interval: ScheduleInterval, fromDate?: Date): Date {
  const now = fromDate || new Date();
  const next = new Date(now);

  switch (interval) {
    case '15min':
      next.setMinutes(next.getMinutes() + 15);
      break;
    case 'hourly':
      next.setHours(next.getHours() + 1);
      break;
    case 'daily':
      next.setDate(next.getDate() + 1);
      break;
    case 'weekly':
      next.setDate(next.getDate() + 7);
      break;
  }

  return next;
}
