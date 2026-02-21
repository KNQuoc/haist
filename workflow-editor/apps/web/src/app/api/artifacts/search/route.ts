import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { findRelevantArtifacts } from '@/lib/artifacts';

/**
 * POST /api/artifacts/search - Search artifacts semantically
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { query, limit = 5, includeIds = [], excludeIds = [] } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    const artifacts = await findRelevantArtifacts({
      userId: session.user.id,
      query: query.trim(),
      limit,
      includeIds,
      excludeIds,
    });

    return NextResponse.json({ artifacts });
  } catch (error) {
    console.error('Error searching artifacts:', error);
    return NextResponse.json(
      { error: 'Failed to search artifacts' },
      { status: 500 }
    );
  }
}
