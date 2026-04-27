'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { API_URL } from '@/config/env';
import { createApiClient } from '@/lib/api';
import { useSession } from '@/lib/session';
import type { TokenPair } from '@/types';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
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

      {/* OAuth buttons */}
      <div className="mb-4 flex flex-col gap-2">
        <a
          href={`${API_URL}/api/v1/auth/oauth/google`}
          className="flex w-full items-center justify-center gap-2 rounded-md border border-[--color-border] bg-[--color-background] px-4 py-2 text-sm font-medium text-[--color-foreground] transition-colors hover:bg-[--color-muted]"
        >
          <GoogleIcon />
          {t('continueWithGoogle')}
        </a>
        <a
          href={`${API_URL}/api/v1/auth/oauth/github`}
          className="flex w-full items-center justify-center gap-2 rounded-md border border-[--color-border] bg-[--color-background] px-4 py-2 text-sm font-medium text-[--color-foreground] transition-colors hover:bg-[--color-muted]"
        >
          <GitHubIcon />
          {t('continueWithGitHub')}
        </a>
      </div>

      {/* Divider */}
      <div className="relative mb-4">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-[--color-border]" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-[--color-card] px-2 text-[--color-muted-foreground]">
            {t('orContinueWith')}
          </span>
        </div>
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
          <div className="flex items-center justify-between">
            <Label htmlFor="password">{t('passwordLabel')}</Label>
            <Link
              href="/forgot-password"
              className="text-xs text-[--color-muted-foreground] hover:text-[--color-foreground] hover:underline"
            >
              {t('forgotPassword')}
            </Link>
          </div>
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

function GoogleIcon(): JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"
      />
    </svg>
  );
}

function GitHubIcon(): JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.335-1.755-1.335-1.755-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.298 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}
