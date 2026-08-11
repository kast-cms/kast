'use client';

import { KastLogo } from '@/components/layout/kast-logo';
import { LoadingBlock } from '@/components/ui/spinner';
import { adminRoute, API_URL } from '@/config/env';
import { useSession } from '@/lib/session';
import type { TokenPair } from '@/types';
import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { type JSX, useEffect } from 'react';

export default function OAuthCallbackPage(): JSX.Element {
  const t = useTranslations('common');
  const searchParams = useSearchParams();
  const router = useRouter();
  const { setSession } = useSession();

  useEffect(() => {
    const code = searchParams.get('code');
    if (!code) {
      router.replace('/login');
      return;
    }

    void (async () => {
      try {
        const res = await fetch(`${API_URL}/api/v1/auth/oauth/exchange`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        });
        if (!res.ok) {
          router.replace('/login');
          return;
        }
        const { data: pair } = (await res.json()) as { data: TokenPair };

        await fetch(adminRoute('/api/auth/set-session'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: pair.refreshToken }),
        });
        setSession(pair);
        router.replace('/content-types');
      } catch {
        router.replace('/login');
      }
    })();
  }, [searchParams, router, setSession]);

  return (
    <div className="surface-gradient flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4">
      <KastLogo className="size-10" />
      <LoadingBlock label={t('loading')} className="py-0" />
    </div>
  );
}
