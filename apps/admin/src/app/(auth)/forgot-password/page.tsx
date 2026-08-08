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
    <Card variant="elevated">
      <CardHeader className="px-6 pt-6 text-center">
        <CardTitle className="text-lg">{t('title')}</CardTitle>
        <CardDescription>{t('subtitle')}</CardDescription>
      </CardHeader>

      <CardContent className="px-6 pt-5 pb-6">
        {submitted ? (
          <div className="space-y-4">
            <Alert variant="success">
              <AlertDescription>{t('successMessage')}</AlertDescription>
            </Alert>
            <Button variant="ghost" className="w-full" asChild>
              <Link href="/login">
                <ArrowLeft className="rtl:rotate-180" />
                {t('backToLogin')}
              </Link>
            </Button>
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

            {error !== null && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2 pt-1">
              <Button type="submit" className="w-full" loading={isPending}>
                {isPending ? t('submitting') : t('submit')}
              </Button>
              <Button variant="ghost" className="w-full" asChild>
                <Link href="/login">
                  <ArrowLeft className="rtl:rotate-180" />
                  {t('backToLogin')}
                </Link>
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
