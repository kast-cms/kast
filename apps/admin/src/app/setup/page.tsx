'use client';

import { KastLogo } from '@/components/layout/kast-logo';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { env } from '@/config/env';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { type JSX, useState } from 'react';

export default function SetupPage(): JSX.Element {
  const t = useTranslations('setup');
  const router = useRouter();

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setError(null);

    if (form.password !== form.confirmPassword) {
      setError(t('errorPasswordMismatch'));
      return;
    }

    setIsPending(true);

    try {
      const res = await fetch(`${env.NEXT_PUBLIC_API_URL}/api/v1/auth/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          password: form.password,
        }),
      });

      if (!res.ok) {
        const body = (await res.json()) as { message?: string };
        setError(body.message ?? t('errorGeneric'));
        return;
      }

      router.replace('/login');
    } catch {
      setError(t('errorGeneric'));
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="surface-gradient flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <div className="flex w-full max-w-md flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-2.5">
          <KastLogo className="size-10" />
          <span className="text-2xs font-medium tracking-[0.2em] text-muted-foreground uppercase">
            Kast CMS
          </span>
        </div>

        <Card variant="elevated" className="w-full">
          <CardHeader className="px-6 pt-6 text-center">
            <CardTitle className="text-lg">{t('title')}</CardTitle>
            <CardDescription>{t('subtitle')}</CardDescription>
          </CardHeader>

          <CardContent className="px-6 pt-5 pb-6">
            <form onSubmit={(e) => void handleSubmit(e)} noValidate className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="firstName">{t('firstNameLabel')}</Label>
                  <Input
                    id="firstName"
                    name="firstName"
                    autoComplete="given-name"
                    value={form.firstName}
                    onChange={handleChange}
                    required
                    disabled={isPending}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lastName">{t('lastNameLabel')}</Label>
                  <Input
                    id="lastName"
                    name="lastName"
                    autoComplete="family-name"
                    value={form.lastName}
                    onChange={handleChange}
                    required
                    disabled={isPending}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email">{t('emailLabel')}</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={handleChange}
                  required
                  disabled={isPending}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="password">{t('passwordLabel')}</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    value={form.password}
                    onChange={handleChange}
                    required
                    disabled={isPending}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword">{t('confirmPasswordLabel')}</Label>
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    value={form.confirmPassword}
                    onChange={handleChange}
                    required
                    disabled={isPending}
                  />
                </div>
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
