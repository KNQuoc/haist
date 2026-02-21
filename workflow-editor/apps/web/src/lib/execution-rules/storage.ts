/**
 * Convex storage for execution rules
 */

import { convex, api } from '@/lib/convex';
import type {
  ExecutionRule,
  ExecutionRuleInput,
  ExecutionStep,
  OutputConfig,
  ActivationMode,
  ScheduleInterval,
} from './types';
import type { Id } from '../../../convex/_generated/dataModel';

function toISO(ts?: number | null): string {
  return ts ? new Date(ts).toISOString() : new Date().toISOString();
}

function mapDoc(doc: Record<string, unknown>): ExecutionRule {
  return {
    id: doc._id as string,
    userId: doc.userId as string,
    name: doc.name as string,
    description: doc.description as string | undefined,
    isActive: Boolean(doc.isActive),
    priority: (doc.priority as number) || 0,
    acceptedTriggers: (doc.acceptedTriggers as string[]) || [],
    topicCondition: doc.topicCondition as string,
    executionSteps: (doc.executionSteps as ExecutionStep[]) || [],
    outputConfig: (doc.outputConfig as OutputConfig) || { platform: 'none', format: 'summary' },
    executionCount: (doc.executionCount as number) || 0,
    lastExecutedAt: doc.lastExecutedAt ? toISO(doc.lastExecutedAt as number) : undefined,
    createdAt: toISO(doc.createdAt as number),
    updatedAt: toISO(doc.updatedAt as number),
    activationMode: (doc.activationMode as ActivationMode) || 'trigger',
    scheduleEnabled: Boolean(doc.scheduleEnabled),
    scheduleInterval: doc.scheduleInterval as ScheduleInterval | undefined,
    scheduleLastRun: doc.scheduleLastRun ? toISO(doc.scheduleLastRun as number) : undefined,
    scheduleNextRun: doc.scheduleNextRun ? toISO(doc.scheduleNextRun as number) : undefined,
  };
}

/**
 * Execution rules storage operations
 */
export const executionRulesStorage = {
  async getByUserId(userId: string): Promise<ExecutionRule[]> {
    const docs = await convex.query(api.executionRules.list, { userId });
    return docs.map(mapDoc);
  },

  async getActiveByUserId(userId: string): Promise<ExecutionRule[]> {
    const docs = await convex.query(api.executionRules.listActive, { userId });
    return docs.map(mapDoc);
  },

  async get(id: string): Promise<ExecutionRule | undefined> {
    const doc = await convex.query(api.executionRules.get, { id: id as Id<"execution_rules"> });
    if (!doc) return undefined;
    return mapDoc(doc);
  },

  async create(userId: string, input: ExecutionRuleInput): Promise<ExecutionRule> {
    const id = await convex.mutation(api.executionRules.create, {
      userId,
      name: input.name,
      description: input.description,
      isActive: input.isActive ?? true,
      priority: input.priority ?? 0,
      acceptedTriggers: input.acceptedTriggers || [],
      topicCondition: input.topicCondition,
      executionSteps: input.executionSteps as any,
      outputConfig: input.outputConfig as any,
      activationMode: input.activationMode ?? 'trigger',
      scheduleEnabled: input.scheduleEnabled,
      scheduleInterval: input.scheduleInterval,
    });

    const created = await this.get(id as string);
    if (!created) throw new Error('Failed to create execution rule');
    return created;
  },

  async update(id: string, input: Partial<ExecutionRuleInput>): Promise<ExecutionRule | undefined> {
    await convex.mutation(api.executionRules.update, {
      id: id as Id<"execution_rules">,
      ...Object.fromEntries(
        Object.entries({
          name: input.name,
          description: input.description,
          isActive: input.isActive,
          priority: input.priority,
          acceptedTriggers: input.acceptedTriggers,
          topicCondition: input.topicCondition,
          executionSteps: input.executionSteps as any,
          outputConfig: input.outputConfig as any,
          activationMode: input.activationMode,
          scheduleEnabled: input.scheduleEnabled,
          scheduleInterval: input.scheduleInterval,
        }).filter(([, v]) => v !== undefined)
      ),
    } as any);
    return this.get(id);
  },

  async delete(id: string): Promise<boolean> {
    try {
      await convex.mutation(api.executionRules.remove, { id: id as Id<"execution_rules"> });
      return true;
    } catch {
      return false;
    }
  },

  async hasActiveRules(userId: string): Promise<boolean> {
    const docs = await convex.query(api.executionRules.listActive, { userId });
    return docs.length > 0;
  },

  async incrementExecutionCount(id: string): Promise<void> {
    await convex.mutation(api.executionRules.incrementExecutionCount, { id: id as Id<"execution_rules"> });
  },

  async getManualRules(userId: string): Promise<ExecutionRule[]> {
    const docs = await convex.query(api.executionRules.listActive, { userId });
    return docs
      .filter((d: any) => d.activationMode === 'manual' || d.activationMode === 'all')
      .map(mapDoc);
  },

  async getScheduledRulesDue(): Promise<ExecutionRule[]> {
    // Convex doesn't have a dedicated query for this; filter client-side
    // TODO: Add a Convex query for scheduled rules due
    console.warn('getScheduledRulesDue: not fully implemented in Convex, returning empty');
    return [];
  },

  async updateScheduleRun(id: string, interval: ScheduleInterval): Promise<void> {
    // Increment count and update timestamps via incrementExecutionCount
    await convex.mutation(api.executionRules.incrementExecutionCount, { id: id as Id<"execution_rules"> });
  },

  async getByIdAndUser(id: string, userId: string): Promise<ExecutionRule | undefined> {
    const doc = await convex.query(api.executionRules.get, { id: id as Id<"execution_rules"> });
    if (!doc || (doc as any).userId !== userId) return undefined;
    return mapDoc(doc);
  },
};
