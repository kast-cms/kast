'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { API_URL } from '@/config/env';
import { ArrowLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { type JSX, useState } from 'react';

/**
 * Landing page for the invitation email. Copy is shared with the reset screen —
 * both ask an unauthenticated visitor holding a single-use token to choose a
 * password — until dedicated `auth.acceptInvite` messages exist.
 */
export default function AcceptInvitePage(): JSX.Element {
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
      const res = await fetch(`${API_URL}/api/v1/auth/accept-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
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
      <Card variant="elevated">
        <CardHeader className="px-6 pt-6 text-center">
          <CardTitle className="text-lg">{t('title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 px-6 pt-5 pb-6">
          <Alert variant="destructive">
            <AlertDescription>{t('missingToken')}</AlertDescription>
          </Alert>
          <Button variant="ghost" className="w-full" asChild>
            <Link href="/login">
              <ArrowLeft className="rtl:rotate-180" />
              {t('backToLogin')}
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card variant="elevated">
      <CardHeader className="px-6 pt-6 text-center">
        <CardTitle className="text-lg">{t('title')}</CardTitle>
        <CardDescription>{t('subtitle')}</CardDescription>
      </CardHeader>

      <CardContent className="px-6 pt-5 pb-6">
        {done ? (
          <div className="space-y-4">
            <Alert variant="success">
              <AlertDescription>{t('successMessage')}</AlertDescription>
            </Alert>
            <Button className="w-full" asChild>
              <Link href="/login">{t('backToLogin')}</Link>
            </Button>
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

            {error !== null && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="w-full" loading={isPending}>
              {isPending ? t('submitting') : t('submit')}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
