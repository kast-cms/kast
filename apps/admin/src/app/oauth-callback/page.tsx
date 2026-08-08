'use client';

import { KastLogo } from '@/components/layout/kast-logo';
import { LoadingBlock } from '@/components/ui/spinner';
import { adminRoute } from '@/config/env';
import { useSession } from '@/lib/session';
import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { type JSX, useEffect } from 'react';

export default function OAuthCallbackPage(): JSX.Element {
  const t = useTranslations('common');
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
      await fetch(adminRoute('/api/auth/set-session'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      setSession({ accessToken, refreshToken, expiresIn: 900, user: null as never });
      router.replace('/content-types');
    })();
  }, [searchParams, router, setSession]);

  return (
    <div className="surface-gradient flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4">
      <KastLogo className="size-10" />
      <LoadingBlock label={t('loading')} className="py-0" />
    </div>
  );
}
