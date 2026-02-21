import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { AutomationsClient } from '@/components/automations/AutomationsClient';

export default async function AutomationsPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect('/login');
  }

  return <AutomationsClient />;
}
