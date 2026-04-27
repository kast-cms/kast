'use client';

import { Spinner } from '@/components/ui/spinner';
import { useSession } from '@/lib/session';
import { useRouter, useSearchParams } from 'next/navigation';
import { type JSX, useEffect } from 'react';

export default function OAuthCallbackPage(): JSX.Element {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { setSession } = useSession();

  useEffect(() => {
    const accessToken = searchParams.get('accessToken');
    const refreshToken = searchParams.get('refreshToken');
    if (!accessToken || !refreshToken) {
      router.replace('/login');
      return;
    }

    void (async () => {
      await fetch('/api/auth/set-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      setSession({ accessToken, refreshToken, expiresIn: 900, user: null as never });
      router.replace('/content-types');
    })();
  }, [searchParams, router, setSession]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Spinner size="lg" />
    </div>
  );
}
