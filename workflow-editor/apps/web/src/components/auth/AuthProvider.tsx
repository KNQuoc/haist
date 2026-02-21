'use client';

import { useSession } from '@/lib/auth-client';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Don't redirect if we're already on the login page
    if (pathname === '/login') return;

    // Redirect to login if not authenticated
    if (!isPending && !session) {
      router.push('/login');
    }
  }, [session, isPending, router, pathname]);

  // Show loading state while checking authentication
  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render children if not authenticated (unless on login page)
  if (!session && pathname !== '/login') {
    return null;
  }

  return <>{children}</>;
}
