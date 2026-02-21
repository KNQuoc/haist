import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { artifactService } from '@/lib/artifacts';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/artifacts/[id] - Get a single artifact with entries
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
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

    const { id } = await params;
    const artifact = await artifactService.getWithEntries(id);

    if (!artifact) {
      return NextResponse.json(
        { error: 'Artifact not found' },
        { status: 404 }
      );
    }

    // Check ownership
    if (artifact.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    return NextResponse.json({ artifact });
  } catch (error) {
    console.error('Error fetching artifact:', error);
    return NextResponse.json(
      { error: 'Failed to fetch artifact' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/artifacts/[id] - Update an artifact
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
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

    const { id } = await params;
    const existing = await artifactService.get(id);

    if (!existing) {
      return NextResponse.json(
        { error: 'Artifact not found' },
        { status: 404 }
      );
    }

    // Check ownership
    if (existing.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { title, summary, tags } = body;

    const artifact = await artifactService.update(id, {
      title: title?.trim(),
      summary: summary?.trim(),
      tags,
    });

    return NextResponse.json({ artifact, success: true });
  } catch (error) {
    console.error('Error updating artifact:', error);
    return NextResponse.json(
      { error: 'Failed to update artifact' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/artifacts/[id] - Delete an artifact
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
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

    const { id } = await params;
    const existing = await artifactService.get(id);

    if (!existing) {
      return NextResponse.json(
        { error: 'Artifact not found' },
        { status: 404 }
      );
    }

    // Check ownership
    if (existing.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    await artifactService.delete(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting artifact:', error);
    return NextResponse.json(
      { error: 'Failed to delete artifact' },
      { status: 500 }
    );
  }
}
