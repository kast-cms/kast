'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { API_URL } from '@/config/env';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { type JSX, useState } from 'react';

export default function ResetPasswordPage(): JSX.Element {
  const t = useTranslations('auth.resetPassword');
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [isPending, setIsPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError(t('passwordMismatch'));
      return;
    }
    setIsPending(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      });
      if (!res.ok) {
        setError(t('errorInvalid'));
        return;
      }
      setDone(true);
    } catch {
      setError(t('errorGeneric'));
    } finally {
      setIsPending(false);
    }
  };

  if (!token) {
    return (
      <div className="rounded-xl border border-[--color-border] bg-[--color-card] p-8 shadow-sm text-center">
        <p className="text-sm text-[--color-destructive]">{t('missingToken')}</p>
        <Link href="/login" className="mt-4 block text-sm text-[--color-primary] hover:underline">
          {t('backToLogin')}
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[--color-border] bg-[--color-card] p-8 shadow-sm">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-[--color-foreground]">
          {t('title')}
        </h1>
        <p className="mt-1 text-sm text-[--color-muted-foreground]">{t('subtitle')}</p>
      </div>

      {done ? (
        <div className="space-y-4 text-center">
          <p className="text-sm text-[--color-foreground]">{t('successMessage')}</p>
          <Link href="/login" className="text-sm text-[--color-primary] hover:underline">
            {t('backToLogin')}
          </Link>
        </div>
      ) : (
        <form onSubmit={(e) => void handleSubmit(e)} noValidate className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="password">{t('passwordLabel')}</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder={t('passwordPlaceholder')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isPending}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm">{t('confirmLabel')}</Label>
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              placeholder={t('confirmPlaceholder')}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
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
      )}
    </div>
  );
}
