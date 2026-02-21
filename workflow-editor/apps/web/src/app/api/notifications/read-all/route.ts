import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { notificationsStorage } from '@/lib/notifications/storage';

export async function PUT() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await notificationsStorage.markAllAsRead(session.user.id);
  return NextResponse.json({ success: true });
}
