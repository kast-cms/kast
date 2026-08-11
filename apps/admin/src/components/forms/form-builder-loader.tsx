'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useApiClient, useSession } from '@/lib/session';
import type { FormDetail } from '@kast-cms/sdk';
import { useTranslations } from 'next-intl';
import { useEffect, useState, type JSX } from 'react';
import { FormBuilder } from './form-builder';

/** Mirrors the builder's real layout so the page does not jump once it loads. */
function FormBuilderSkeleton({ label }: { label: string }): JSX.Element {
  return (
    <div className="space-y-6" aria-busy="true">
      <p role="status" className="sr-only">
        {label}
      </p>
      <div className="flex items-start justify-between gap-6">
        <Skeleton className="h-7 w-48" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24 rounded-md" />
          <Skeleton className="h-9 w-24 rounded-md" />
        </div>
      </div>
      <Card>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-9 w-full rounded-md" />
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="flex flex-col gap-2">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

interface FormBuilderLoaderProps {
  formId: string;
}

export function FormBuilderLoader({ formId }: FormBuilderLoaderProps): JSX.Element {
  const client = useApiClient();
  const tc = useTranslations('common');
  const { session } = useSession();
  const [form, setForm] = useState<FormDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    setLoading(true);
    client.forms
      .findOne(formId)
      .then((data) => {
        setForm(data);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load form');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [session, formId, client]);

  if (loading) {
    return <FormBuilderSkeleton label={tc('loading')} />;
  }

  if (error !== null || form === null) {
    return (
      <Alert variant="destructive">
        <AlertTitle>{tc('error')}</AlertTitle>
        <AlertDescription>{error ?? 'Form not found'}</AlertDescription>
      </Alert>
    );
  }

  return <FormBuilder initial={form} />;
}
