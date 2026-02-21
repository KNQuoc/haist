import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { AIAssistantClient } from '@/components/ai-assistant/AIAssistantClient';

export default async function AIAssistantPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect('/login');
  }

  return <AIAssistantClient />;
}
