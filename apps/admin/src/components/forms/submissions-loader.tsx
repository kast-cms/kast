'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useApiClient, useSession } from '@/lib/session';
import type { FormDetail } from '@kast-cms/sdk';
import { useTranslations } from 'next-intl';
import { useEffect, useState, type JSX } from 'react';
import { SubmissionsPageClient } from './submissions-page';

/** Header + table placeholder, sized like the real screen so nothing reflows. */
function SubmissionsSkeleton({ label }: { label: string }): JSX.Element {
  return (
    <div className="space-y-6" aria-busy="true">
      <p role="status" className="sr-only">
        {label}
      </p>
      <div className="flex flex-col gap-4">
        <Skeleton className="h-5 w-20 rounded-md" />
        <div className="flex items-start justify-between gap-6">
          <div className="space-y-2">
            <Skeleton className="h-7 w-56" />
            <Skeleton className="h-3.5 w-32" />
          </div>
          <Skeleton className="h-9 w-32 rounded-md" />
        </div>
      </div>
      <Card className="overflow-hidden">
        <div className="h-10 border-b border-border bg-muted/60" />
        <div className="flex flex-col gap-4 p-4">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </div>
      </Card>
    </div>
  );
}

interface SubmissionsLoaderProps {
  formId: string;
}

export function SubmissionsLoader({ formId }: SubmissionsLoaderProps): JSX.Element {
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
    return <SubmissionsSkeleton label={tc('loading')} />;
  }

  if (error !== null || form === null) {
    return (
      <Alert variant="destructive">
        <AlertTitle>{tc('error')}</AlertTitle>
        <AlertDescription>{error ?? 'Form not found'}</AlertDescription>
      </Alert>
    );
  }

  return <SubmissionsPageClient formId={formId} formName={form.name} />;
}
