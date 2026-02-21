/**
 * Composio Trigger Status API Route
 *
 * PATCH /api/composio/triggers/[triggerId]/status - Enable/disable a trigger
 */

import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { composioService } from '@/lib/composio/composio-service';

type RouteParams = {
  params: Promise<{ triggerId: string }>;
};

/**
 * PATCH - Enable or disable a trigger
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!process.env.COMPOSIO_API_KEY) {
      return NextResponse.json(
        { error: 'COMPOSIO_API_KEY is not configured' },
        { status: 500 }
      );
    }

    const { triggerId } = await params;
    const body = await request.json();
    const { status } = body;

    if (!triggerId) {
      return NextResponse.json(
        { error: 'triggerId is required' },
        { status: 400 }
      );
    }

    if (!status || !['enable', 'disable'].includes(status)) {
      return NextResponse.json(
        { error: 'status must be "enable" or "disable"' },
        { status: 400 }
      );
    }

    let result;
    if (status === 'enable') {
      result = await composioService.enableTrigger(triggerId);
    } else {
      result = await composioService.disableTrigger(triggerId);
    }

    return NextResponse.json({
      success: true,
      status: result.status,
    });
  } catch (error) {
    console.error('Update trigger status error:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to update trigger status',
      },
      { status: 500 }
    );
  }
}
