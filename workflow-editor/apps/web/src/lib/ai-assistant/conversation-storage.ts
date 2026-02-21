/**
 * Convex storage for AI Assistant conversations
 */

import { convex, api } from '@/lib/convex';
import type {
  Conversation,
  AssistantMode,
  ChatMessage,
  ToolRouterMessage,
} from './types';
import type { Id } from '../../../convex/_generated/dataModel';

function toISO(ts?: number | null): string {
  return ts ? new Date(ts).toISOString() : new Date().toISOString();
}

/**
 * Generate a title from message content
 */
function generateTitle(content: string): string {
  const cleaned = content.trim().replace(/\s+/g, ' ');
  if (cleaned.length <= 40) return cleaned;
  return cleaned.substring(0, 40).trim() + '...';
}

export const conversationsStorage = {
  async getByUserId(userId: string): Promise<Conversation[]> {
    const convDocs = await convex.query(api.conversations.list, { userId });

    const conversations: Conversation[] = [];
    for (const doc of convDocs) {
      const msgDocs = await convex.query(api.conversations.getMessages, {
        conversationId: doc._id as Id<"conversations">,
      });

      const toolRouterMessages: ToolRouterMessage[] = msgDocs.map((m: any) => ({
        id: m._id as string,
        role: m.role,
        content: m.content,
        timestamp: toISO(m.createdAt),
        toolCalls: m.metadata?.toolCalls,
      }));

      conversations.push({
        id: doc._id as string,
        title: (doc as any).title || 'New conversation',
        mode: (doc as any).mode || 'chat',
        createdAt: toISO((doc as any).createdAt),
        updatedAt: toISO((doc as any).updatedAt),
        messages: [],
        toolRouterMessages,
      });
    }

    return conversations;
  },

  async get(id: string): Promise<Conversation | null> {
    const doc = await convex.query(api.conversations.get, { id: id as Id<"conversations"> });
    if (!doc) return null;

    const msgDocs = await convex.query(api.conversations.getMessages, {
      conversationId: id as Id<"conversations">,
    });

    const toolRouterMessages: ToolRouterMessage[] = msgDocs.map((m: any) => ({
      id: m._id as string,
      role: m.role,
      content: m.content,
      timestamp: toISO(m.createdAt),
      toolCalls: m.metadata?.toolCalls,
    }));

    return {
      id: doc._id as string,
      title: (doc as any).title || 'New conversation',
      mode: (doc as any).mode || 'chat',
      createdAt: toISO((doc as any).createdAt),
      updatedAt: toISO((doc as any).updatedAt),
      messages: [],
      toolRouterMessages,
    };
  },

  async create(userId: string, mode: AssistantMode): Promise<Conversation> {
    const id = await convex.mutation(api.conversations.create, {
      userId,
      title: 'New conversation',
    });

    return {
      id: id as string,
      title: 'New conversation',
      mode,
      messages: [],
      toolRouterMessages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  },

  async addMessage(
    conversationId: string,
    message: ChatMessage | ToolRouterMessage,
    _mode: AssistantMode
  ): Promise<void> {
    const toolMsg = message as ToolRouterMessage;
    await convex.mutation(api.conversations.sendMessage, {
      conversationId: conversationId as Id<"conversations">,
      role: toolMsg.role as 'user' | 'assistant' | 'system',
      content: toolMsg.content,
      metadata: toolMsg.toolCalls ? { toolCalls: toolMsg.toolCalls } : undefined,
    });

    // Auto-title on first user message
    if (message.role === 'user') {
      const msgs = await convex.query(api.conversations.getMessages, {
        conversationId: conversationId as Id<"conversations">,
      });
      if (msgs.length === 1) {
        const title = generateTitle(message.content);
        await convex.mutation(api.conversations.updateTitle, {
          id: conversationId as Id<"conversations">,
          title,
        });
      }
    }
  },

  async updateMode(_id: string, _mode: AssistantMode): Promise<void> {
    // Convex schema doesn't have mode field on conversations
    console.warn('updateMode: mode field not in Convex schema, skipping');
  },

  async rename(id: string, title: string): Promise<void> {
    await convex.mutation(api.conversations.updateTitle, {
      id: id as Id<"conversations">,
      title,
    });
  },

  async delete(id: string): Promise<boolean> {
    try {
      await convex.mutation(api.conversations.remove, { id: id as Id<"conversations"> });
      return true;
    } catch {
      return false;
    }
  },

  async findInactiveConversations(_thresholdMs: number): Promise<Conversation[]> {
    console.warn('TODO: implement findInactiveConversations in Convex');
    return [];
  },

  async markAsSummarized(_id: string): Promise<void> {
    console.warn('TODO: implement markAsSummarized in Convex');
  },

  async getUserId(id: string): Promise<string | null> {
    const doc = await convex.query(api.conversations.get, { id: id as Id<"conversations"> });
    if (!doc) return null;
    return (doc as any).userId || null;
  },
};
