/**
 * Composio Execute Tool API Route
 *
 * POST /api/composio/execute
 * Executes a Composio tool with the provided arguments
 */

import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { composioService } from '@/lib/composio/composio-service';

interface ExecuteRequest {
  toolName: string;
  arguments: Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user session
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const body: ExecuteRequest = await request.json();
    const { toolName, arguments: args } = body;

    // Validate request
    if (!toolName) {
      return NextResponse.json(
        { error: 'toolName is required' },
        { status: 400 }
      );
    }

    // Check if Composio API key is configured
    if (!process.env.COMPOSIO_API_KEY) {
      return NextResponse.json(
        { error: 'COMPOSIO_API_KEY is not configured' },
        { status: 500 }
      );
    }

    console.log(`Executing Composio tool: ${toolName}`, {
      userId,
      args: JSON.stringify(args).slice(0, 200),
    });

    // Execute the tool
    const result = await composioService.executeTool(toolName, userId, args);

    if (result.successful) {
      return NextResponse.json({
        success: true,
        data: result.data,
        toolName,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Tool execution failed',
          toolName,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Execute tool error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
