'use client';

import { createApiClient } from '@/lib/api';
import { useSession } from '@/lib/session';
import type { FormDetail } from '@kast/sdk';
import { useEffect, useState, type JSX } from 'react';
import { SubmissionsPageClient } from './submissions-page';

interface SubmissionsLoaderProps {
  formId: string;
}

export function SubmissionsLoader({ formId }: SubmissionsLoaderProps): JSX.Element {
  const { session } = useSession();
  const [form, setForm] = useState<FormDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    setLoading(true);
    const client = createApiClient(session.accessToken);
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
  }, [session, formId]);

  if (loading) {
    return <p className="py-20 text-center text-muted-foreground">Loading…</p>;
  }

  if (error || !form) {
    return <p className="py-20 text-center text-destructive">{error ?? 'Form not found'}</p>;
  }

  return <SubmissionsPageClient formId={formId} formName={form.name} />;
}
