import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { notificationsStorage } from '@/lib/notifications/storage';

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = req.nextUrl;
  const unreadOnly = url.searchParams.get('unreadOnly') === 'true';
  const limit = parseInt(url.searchParams.get('limit') || '20', 10);
  const offset = parseInt(url.searchParams.get('offset') || '0', 10);

  const result = await notificationsStorage.getByUserId(session.user.id, {
    unreadOnly,
    limit,
    offset,
  });

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const notification = await notificationsStorage.create({
    userId: session.user.id,
    type: body.type,
    title: body.title,
    body: body.body,
    ruleId: body.ruleId,
    ruleName: body.ruleName,
    logId: body.logId,
  });

  return NextResponse.json(notification, { status: 201 });
}
