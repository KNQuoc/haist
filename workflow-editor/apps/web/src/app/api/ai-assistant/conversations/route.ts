/**
 * API routes for AI Assistant conversations
 *
 * GET /api/ai-assistant/conversations - List all conversations for the user
 * POST /api/ai-assistant/conversations - Create a new conversation
 */

import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { conversationsStorage } from '@/lib/ai-assistant/conversation-storage';
import type { AssistantMode } from '@/lib/ai-assistant/types';

/**
 * GET - List all conversations for the authenticated user
 */
export async function GET() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const conversations = await conversationsStorage.getByUserId(session.user.id);

    return NextResponse.json({ conversations });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch conversations' },
      { status: 500 }
    );
  }
}

/**
 * POST - Create a new conversation
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const mode: AssistantMode = 'tool-router';

    const conversation = await conversationsStorage.create(session.user.id, mode);

    return NextResponse.json({ conversation });
  } catch (error) {
    console.error('Error creating conversation:', error);
    return NextResponse.json(
      { error: 'Failed to create conversation' },
      { status: 500 }
    );
  }
}
