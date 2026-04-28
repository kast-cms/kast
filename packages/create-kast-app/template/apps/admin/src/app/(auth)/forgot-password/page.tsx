'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { API_URL } from '@/config/env';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { type JSX, useState } from 'react';

export default function ForgotPasswordPage(): JSX.Element {
  const t = useTranslations('auth.forgotPassword');

  const [email, setEmail] = useState('');
  const [isPending, setIsPending] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setError(null);
    setIsPending(true);
    try {
      await fetch(`${API_URL}/api/v1/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setSubmitted(true);
    } catch {
      setError(t('errorGeneric'));
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="rounded-xl border border-[--color-border] bg-[--color-card] p-8 shadow-sm">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-[--color-foreground]">
          {t('title')}
        </h1>
        <p className="mt-1 text-sm text-[--color-muted-foreground]">{t('subtitle')}</p>
      </div>

      {submitted ? (
        <div className="space-y-4 text-center">
          <p className="text-sm text-[--color-foreground]">{t('successMessage')}</p>
          <Link href="/login" className="text-sm text-[--color-primary] hover:underline">
            {t('backToLogin')}
          </Link>
        </div>
      ) : (
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

          <p className="text-center text-sm text-[--color-muted-foreground]">
            <Link href="/login" className="hover:text-[--color-foreground] hover:underline">
              {t('backToLogin')}
            </Link>
          </p>
        </form>
      )}
    </div>
  );
}
