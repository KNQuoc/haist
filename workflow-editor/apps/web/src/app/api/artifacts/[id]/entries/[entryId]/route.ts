import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { artifactService } from '@/lib/artifacts';

interface RouteParams {
  params: Promise<{ id: string; entryId: string }>;
}

/**
 * PATCH /api/artifacts/[id]/entries/[entryId] - Update an entry's content
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, entryId } = await params;
    const artifact = await artifactService.get(id);

    if (!artifact) {
      return NextResponse.json({ error: 'Artifact not found' }, { status: 404 });
    }

    if (artifact.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { content } = body;

    if (!content || typeof content !== 'string') {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    const entry = await artifactService.updateEntry(entryId, content.trim());

    return NextResponse.json({ entry, success: true });
  } catch (error) {
    console.error('Error updating entry:', error);
    return NextResponse.json({ error: 'Failed to update entry' }, { status: 500 });
  }
}
