/**
 * Convex storage for notifications
 */

import { convex, api } from '@/lib/convex';
import type { Notification, NotificationInput } from './types';
import type { Id } from '../../../convex/_generated/dataModel';

function toISO(ts?: number | null): string {
  return ts ? new Date(ts).toISOString() : new Date().toISOString();
}

function mapDoc(doc: Record<string, unknown>): Notification {
  return {
    id: doc._id as string,
    userId: doc.userId as string,
    type: doc.type as Notification['type'],
    title: doc.title as string,
    body: (doc.body as string) || '',
    ruleId: doc.ruleId as string | undefined,
    ruleName: doc.ruleName as string | undefined,
    logId: doc.logId as string | undefined,
    read: Boolean(doc.read),
    createdAt: toISO(doc.createdAt as number),
  };
}

export const notificationsStorage = {
  async create(input: NotificationInput): Promise<Notification> {
    const id = await convex.mutation(api.notifications.create, {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body || undefined,
      ruleId: input.ruleId as Id<"execution_rules"> | undefined,
      ruleName: input.ruleName,
      logId: input.logId as Id<"execution_logs"> | undefined,
    });

    // Return a constructed notification since Convex create returns just the ID
    return {
      id: id as string,
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      ruleId: input.ruleId,
      ruleName: input.ruleName,
      logId: input.logId,
      read: false,
      createdAt: new Date().toISOString(),
    };
  },

  async getByUserId(
    userId: string,
    options?: { unreadOnly?: boolean; limit?: number; offset?: number }
  ): Promise<{ notifications: Notification[]; total: number; unreadCount: number }> {
    const { unreadOnly = false, limit = 20, offset = 0 } = options || {};

    const [allDocs, unreadCount] = await Promise.all([
      convex.query(api.notifications.list, { userId }),
      convex.query(api.notifications.getUnreadCount, { userId }),
    ]);

    let filtered = unreadOnly ? allDocs.filter(d => !d.read) : allDocs;
    const total = filtered.length;
    const sliced = filtered.slice(offset, offset + limit);

    return {
      notifications: sliced.map(mapDoc),
      total,
      unreadCount,
    };
  },

  async markAsRead(id: string, _userId: string): Promise<void> {
    await convex.mutation(api.notifications.markRead, { id: id as Id<"notifications"> });
  },

  async markAllAsRead(userId: string): Promise<void> {
    await convex.mutation(api.notifications.markAllRead, { userId });
  },

  async delete(id: string, _userId: string): Promise<void> {
    await convex.mutation(api.notifications.remove, { id: id as Id<"notifications"> });
  },

  async getUnreadCount(userId: string): Promise<number> {
    return await convex.query(api.notifications.getUnreadCount, { userId });
  },
};
