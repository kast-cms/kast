'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { createApiClient } from '@/lib/api';
import { useSession } from '@/lib/session';
import type { TokenPair } from '@/types';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { type JSX, useState } from 'react';

export default function LoginPage(): JSX.Element {
  const t = useTranslations('auth.login');
  const router = useRouter();
  const { setSession } = useSession();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setError(null);
    setIsPending(true);

    try {
      const client = createApiClient();
      const res = (await client.auth.login(email, password)) as { data: TokenPair };
      const pair = res.data;

      // Persist refresh token in HttpOnly cookie via server route
      await fetch('/api/auth/set-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: pair.refreshToken }),
      });

      // Store access token in memory via session context
      setSession(pair);

      router.push('/content-types');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '';
      const isUnauthorized = (err as { status?: number }).status === 401 || message.includes('401');
      setError(isUnauthorized ? t('errorInvalid') : t('errorGeneric'));
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="rounded-xl border border-[--color-border] bg-[--color-card] p-8 shadow-sm">
      {/* Header */}
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-[--color-foreground]">
          {t('title')}
        </h1>
        <p className="mt-1 text-sm text-[--color-muted-foreground]">{t('subtitle')}</p>
      </div>

      {/* Form */}
      <form onSubmit={(e) => void handleSubmit(e)} noValidate className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">{t('emailLabel')}</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder={t('emailPlaceholder')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isPending}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">{t('passwordLabel')}</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder={t('passwordPlaceholder')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={isPending}
          />
        </div>

        {error && (
          <p role="alert" className="text-sm text-[--color-destructive]">
            {error}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? (
            <>
              <Spinner size="sm" />
              {t('submitting')}
            </>
          ) : (
            t('submit')
          )}
        </Button>
      </form>
    </div>
  );
}
