/**
 * Convex storage for execution logs
 */

import { convex, api } from '@/lib/convex';
import type { ExecutionLogEntry, ExecutionLogStats } from './types';
import type { Id } from '../../../convex/_generated/dataModel';

function toISO(ts?: number | null): string {
  return ts ? new Date(ts).toISOString() : new Date().toISOString();
}

function mapDoc(doc: Record<string, unknown>): ExecutionLogEntry {
  return {
    id: doc._id as string,
    ruleId: doc.ruleId as string,
    ruleName: doc.ruleName as string,
    userId: doc.userId as string,
    triggerSlug: (doc.triggerSlug as string) || '',
    status: doc.status as 'success' | 'failure' | 'partial',
    stepsJson: (doc.stepsJson as ExecutionLogEntry['stepsJson']) || [],
    outputText: (doc.outputText as string) || undefined,
    errorText: (doc.errorText as string) || undefined,
    durationMs: (doc.durationMs as number) || undefined,
    createdAt: toISO(doc.createdAt as number),
  };
}

export const executionLogStorage = {
  async create(log: Omit<ExecutionLogEntry, 'id' | 'createdAt'>): Promise<ExecutionLogEntry> {
    const id = await convex.mutation(api.executionLogs.create, {
      ruleId: log.ruleId as Id<"execution_rules">,
      ruleName: log.ruleName,
      userId: log.userId,
      triggerSlug: log.triggerSlug || undefined,
      status: log.status,
      stepsJson: log.stepsJson || [],
      outputText: log.outputText || undefined,
      errorText: log.errorText || undefined,
      durationMs: log.durationMs || undefined,
    });

    return {
      id: id as string,
      ruleId: log.ruleId,
      ruleName: log.ruleName,
      userId: log.userId,
      triggerSlug: log.triggerSlug,
      status: log.status,
      stepsJson: log.stepsJson || [],
      outputText: log.outputText,
      errorText: log.errorText,
      durationMs: log.durationMs,
      createdAt: new Date().toISOString(),
    };
  },

  async getByRuleId(ruleId: string, limit = 50, offset = 0): Promise<{ logs: ExecutionLogEntry[]; total: number }> {
    const docs = await convex.query(api.executionLogs.listByRule, {
      ruleId: ruleId as Id<"execution_rules">,
    });
    const total = docs.length;
    const sliced = docs.slice(offset, offset + limit);
    return { logs: sliced.map(mapDoc), total };
  },

  async getByUserId(userId: string, limit = 50, offset = 0): Promise<{ logs: ExecutionLogEntry[]; total: number }> {
    const docs = await convex.query(api.executionLogs.list, { userId });
    const total = docs.length;
    const sliced = docs.slice(offset, offset + limit);
    return { logs: sliced.map(mapDoc), total };
  },

  async getRecent(userId: string, limit = 10): Promise<ExecutionLogEntry[]> {
    const docs = await convex.query(api.executionLogs.list, { userId, limit });
    return docs.map(mapDoc);
  },

  async deleteOlderThan(_days: number): Promise<number> {
    console.warn('TODO: implement deleteOlderThan in Convex');
    return 0;
  },

  async getStats(userId: string): Promise<ExecutionLogStats> {
    const s = await convex.query(api.executionLogs.stats, { userId });
    return {
      totalRuns: s.total,
      successRate: s.total > 0 ? (s.success / s.total) * 100 : 0,
      avgDurationMs: Math.round(s.avgDuration),
    };
  },

  async getStatsByRuleId(ruleId: string): Promise<ExecutionLogStats> {
    // Convex doesn't have a per-rule stats query; compute client-side
    const { logs } = await this.getByRuleId(ruleId, 10000, 0);
    const total = logs.length;
    const success = logs.filter(l => l.status === 'success').length;
    const avgMs = total > 0
      ? logs.reduce((sum, l) => sum + (l.durationMs || 0), 0) / total
      : 0;
    return {
      totalRuns: total,
      successRate: total > 0 ? (success / total) * 100 : 0,
      avgDurationMs: Math.round(avgMs),
    };
  },
};
