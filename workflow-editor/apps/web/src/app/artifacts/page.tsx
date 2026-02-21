import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { ArtifactsClient } from '@/components/artifacts/ArtifactsClient';

export default async function ArtifactsPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect('/login');
  }

  return <ArtifactsClient />;
}
