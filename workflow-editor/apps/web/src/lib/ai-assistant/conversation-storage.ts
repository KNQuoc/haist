/**
 * Conversation Storage Service
 *
 * PostgreSQL storage for AI Assistant chat conversations.
 * Connects to Supabase PostgreSQL database via DATABASE_URL.
 */

import { v4 as uuidv4 } from 'uuid';
import { pool, isSupabase } from '@/lib/db';
import type {
  Conversation,
  AssistantMode,
  ChatMessage,
  ToolRouterMessage,
} from './types';
const CONVERSATION_TABLE = isSupabase ? 'conversation' : '"Conversation"';
const MESSAGE_TABLE = isSupabase ? 'conversation_message' : '"ConversationMessage"';

// Column name helpers
const col = {
  userId: isSupabase ? 'user_id' : '"userId"',
  conversationId: isSupabase ? 'conversation_id' : '"conversationId"',
  createdAt: isSupabase ? 'created_at' : '"createdAt"',
  updatedAt: isSupabase ? 'updated_at' : '"updatedAt"',
  toolCalls: isSupabase ? 'tool_calls' : '"toolCalls"',
  requiredConnections: isSupabase ? 'required_connections' : '"requiredConnections"',
};

// Database row types
interface ConversationRow {
  id: string;
  user_id?: string;
  userId?: string;
  title: string;
  mode: AssistantMode;
  created_at?: Date;
  createdAt?: Date;
  updated_at?: Date;
  updatedAt?: Date;
}

interface MessageRow {
  id: string;
  conversation_id?: string;
  conversationId?: string;
  role: string;
  content: string;
  workflow?: unknown;
  required_connections?: unknown;
  requiredConnections?: unknown;
  tool_calls?: unknown;
  toolCalls?: unknown;
  created_at?: Date;
  createdAt?: Date;
}

// Helper to map database row to Conversation
function mapConversationRow(row: ConversationRow): Omit<Conversation, 'messages' | 'toolRouterMessages'> {
  const createdAt = row.createdAt || row.created_at;
  const updatedAt = row.updatedAt || row.updated_at;

  return {
    id: row.id,
    title: row.title,
    mode: row.mode,
    createdAt: createdAt instanceof Date ? createdAt.toISOString() : String(createdAt),
    updatedAt: updatedAt instanceof Date ? updatedAt.toISOString() : String(updatedAt),
  };
}

// Helper to map database row to ChatMessage
function mapToChatMessage(row: MessageRow): ChatMessage {
  const createdAt = row.createdAt || row.created_at;
  const requiredConnections = row.requiredConnections || row.required_connections;

  return {
    id: row.id,
    role: row.role as ChatMessage['role'],
    content: row.content,
    timestamp: createdAt instanceof Date ? createdAt.toISOString() : String(createdAt),
    workflow: row.workflow as ChatMessage['workflow'],
    requiredConnections: requiredConnections as string[] | undefined,
  };
}

// Helper to map database row to ToolRouterMessage
function mapToToolRouterMessage(row: MessageRow): ToolRouterMessage {
  const createdAt = row.createdAt || row.created_at;
  const toolCalls = row.toolCalls || row.tool_calls;

  return {
    id: row.id,
    role: row.role as ToolRouterMessage['role'],
    content: row.content,
    timestamp: createdAt instanceof Date ? createdAt.toISOString() : String(createdAt),
    toolCalls: toolCalls as ToolRouterMessage['toolCalls'],
  };
}

/**
 * Conversation storage operations
 */
export const conversationsStorage = {
  /**
   * Get all conversations for a user (optimized with JOIN)
   */
  async getByUserId(userId: string): Promise<Conversation[]> {
    // Use a single JOIN query to fetch conversations with their messages
    const result = await pool.query(
      `SELECT
        c.id as conv_id,
        c.title,
        c.mode,
        c.${col.createdAt} as conv_created_at,
        c.${col.updatedAt} as conv_updated_at,
        m.id as msg_id,
        m.role,
        m.content,
        m.workflow,
        m.${col.requiredConnections},
        m.${col.toolCalls},
        m.${col.createdAt} as msg_created_at
      FROM ${CONVERSATION_TABLE} c
      LEFT JOIN ${MESSAGE_TABLE} m ON c.id = m.${col.conversationId}
      WHERE c.${col.userId} = $1
      ORDER BY c.${col.updatedAt} DESC, m.${col.createdAt} ASC`,
      [userId]
    );

    // Group results by conversation
    const conversationMap = new Map<string, Conversation>();

    for (const row of result.rows) {
      const convId = row.conv_id;

      if (!conversationMap.has(convId)) {
        const createdAt = row.conv_created_at;
        const updatedAt = row.conv_updated_at;

        conversationMap.set(convId, {
          id: convId,
          title: row.title,
          mode: row.mode,
          createdAt: createdAt instanceof Date ? createdAt.toISOString() : String(createdAt),
          updatedAt: updatedAt instanceof Date ? updatedAt.toISOString() : String(updatedAt),
          messages: [],
          toolRouterMessages: [],
        });
      }

      // Add message if exists (LEFT JOIN may return null for conversations with no messages)
      if (row.msg_id) {
        const conv = conversationMap.get(convId)!;
        const msgCreatedAt = row.msg_created_at;
        const timestamp = msgCreatedAt instanceof Date ? msgCreatedAt.toISOString() : String(msgCreatedAt);

        conv.toolRouterMessages.push({
          id: row.msg_id,
          role: row.role,
          content: row.content,
          timestamp,
          toolCalls: row.tool_calls || row.toolCalls,
        });
      }
    }

    return Array.from(conversationMap.values());
  },

  /**
   * Get a specific conversation by ID
   */
  async get(id: string): Promise<Conversation | null> {
    const result = await pool.query(
      `SELECT * FROM ${CONVERSATION_TABLE} WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) return null;

    const conv = mapConversationRow(result.rows[0]);

    // Fetch messages
    const messagesResult = await pool.query(
      `SELECT * FROM ${MESSAGE_TABLE} WHERE ${col.conversationId} = $1 ORDER BY ${col.createdAt} ASC`,
      [id]
    );

    const messages: ChatMessage[] = [];
    const toolRouterMessages: ToolRouterMessage[] = [];

    for (const msgRow of messagesResult.rows) {
      toolRouterMessages.push(mapToToolRouterMessage(msgRow));
    }

    return {
      ...conv,
      messages,
      toolRouterMessages,
    };
  },

  /**
   * Create a new conversation
   */
  async create(userId: string, mode: AssistantMode): Promise<Conversation> {
    const id = uuidv4();
    const now = new Date();

    await pool.query(
      `INSERT INTO ${CONVERSATION_TABLE} (id, ${col.userId}, title, mode, ${col.createdAt}, ${col.updatedAt})
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, userId, 'New conversation', mode, now, now]
    );

    return {
      id,
      title: 'New conversation',
      mode,
      messages: [],
      toolRouterMessages: [],
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
  },

  /**
   * Add a message to a conversation
   */
  async addMessage(
    conversationId: string,
    message: ChatMessage | ToolRouterMessage,
    mode: AssistantMode
  ): Promise<void> {
    const id = message.id || uuidv4();

    const toolMsg = message as ToolRouterMessage;
    await pool.query(
      `INSERT INTO ${MESSAGE_TABLE} (id, ${col.conversationId}, role, content, ${col.toolCalls}, ${col.createdAt})
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        id,
        conversationId,
        toolMsg.role,
        toolMsg.content,
        toolMsg.toolCalls ? JSON.stringify(toolMsg.toolCalls) : null,
        new Date(toolMsg.timestamp),
      ]
    );

    // Update conversation title if it's the first user message
    const countResult = await pool.query(
      `SELECT COUNT(*) as count FROM ${MESSAGE_TABLE} WHERE ${col.conversationId} = $1`,
      [conversationId]
    );

    if (parseInt(countResult.rows[0].count) === 1 && message.role === 'user') {
      const title = generateTitle(message.content);
      await pool.query(
        `UPDATE ${CONVERSATION_TABLE} SET title = $1 WHERE id = $2`,
        [title, conversationId]
      );
    }
  },

  /**
   * Update conversation mode
   */
  async updateMode(id: string, mode: AssistantMode): Promise<void> {
    await pool.query(
      `UPDATE ${CONVERSATION_TABLE} SET mode = $1, ${col.updatedAt} = NOW() WHERE id = $2`,
      [mode, id]
    );
  },

  /**
   * Rename a conversation
   */
  async rename(id: string, title: string): Promise<void> {
    await pool.query(
      `UPDATE ${CONVERSATION_TABLE} SET title = $1, ${col.updatedAt} = NOW() WHERE id = $2`,
      [title, id]
    );
  },

  /**
   * Delete a conversation
   */
  async delete(id: string): Promise<boolean> {
    // Messages are deleted automatically via CASCADE
    const result = await pool.query(
      `DELETE FROM ${CONVERSATION_TABLE} WHERE id = $1 RETURNING id`,
      [id]
    );
    return result.rows.length > 0;
  },

  /**
   * Find conversations that have been inactive for a given threshold
   * and haven't been summarized yet
   */
  async findInactiveConversations(thresholdMs: number): Promise<Conversation[]> {
    const cutoffTime = new Date(Date.now() - thresholdMs);
    const summarizedAtCol = isSupabase ? 'summarized_at' : '"summarizedAt"';

    const result = await pool.query(
      `SELECT * FROM ${CONVERSATION_TABLE}
       WHERE ${col.updatedAt} < $1
         AND (${summarizedAtCol} IS NULL)
       ORDER BY ${col.updatedAt} DESC
       LIMIT 50`,
      [cutoffTime]
    );

    const conversations: Conversation[] = [];

    for (const row of result.rows) {
      const conv = mapConversationRow(row);

      // Fetch messages for this conversation
      const messagesResult = await pool.query(
        `SELECT * FROM ${MESSAGE_TABLE} WHERE ${col.conversationId} = $1 ORDER BY ${col.createdAt} ASC`,
        [row.id]
      );

      const messages: ChatMessage[] = [];
      const toolRouterMessages: ToolRouterMessage[] = [];

      for (const msgRow of messagesResult.rows) {
        toolRouterMessages.push(mapToToolRouterMessage(msgRow));
      }

      conversations.push({
        ...conv,
        messages,
        toolRouterMessages,
      });
    }

    return conversations;
  },

  /**
   * Mark a conversation as summarized
   */
  async markAsSummarized(id: string): Promise<void> {
    const summarizedAtCol = isSupabase ? 'summarized_at' : '"summarizedAt"';
    await pool.query(
      `UPDATE ${CONVERSATION_TABLE} SET ${summarizedAtCol} = NOW() WHERE id = $1`,
      [id]
    );
  },

  /**
   * Get the user ID for a conversation
   */
  async getUserId(id: string): Promise<string | null> {
    const result = await pool.query(
      `SELECT ${col.userId} FROM ${CONVERSATION_TABLE} WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return row.userId || row.user_id || null;
  },
};

/**
 * Generate a title from message content
 */
function generateTitle(content: string): string {
  const cleaned = content.trim().replace(/\s+/g, ' ');
  if (cleaned.length <= 40) {
    return cleaned;
  }
  return cleaned.substring(0, 40).trim() + '...';
}
