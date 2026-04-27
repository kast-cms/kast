'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createApiClient } from '@/lib/api';
import { useSession } from '@/lib/session';
import type { FormDetail, FormFieldInput } from '@kast/sdk';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useCallback, useState, type JSX } from 'react';
import { FormFieldsSection, type FieldRow } from './form-builder-fields';

function makeKey(): string {
  return Math.random().toString(36).slice(2);
}

function emptyField(): FieldRow {
  return { _key: makeKey(), name: '', label: '', type: 'TEXT', isRequired: false, position: 0 };
}

function toInitialFields(initial?: FormDetail): FieldRow[] {
  if (!initial) return [];
  return initial.fields.map((f) => ({ ...f, _key: makeKey(), type: f.type as FieldRow['type'] }));
}

interface FormInit {
  name: string;
  slug: string;
  description: string;
  notifyEmail: string;
  isActive: boolean;
}

function getFormInit(initial: FormDetail | undefined): FormInit {
  if (!initial) return { name: '', slug: '', description: '', notifyEmail: '', isActive: true };
  return {
    name: initial.name,
    slug: initial.slug,
    description: initial.description ?? '',
    notifyEmail: initial.notifyEmail ?? '',
    isActive: initial.isActive,
  };
}

interface FormBuilderProps {
  initial?: FormDetail;
}

export function FormBuilder({ initial }: FormBuilderProps): JSX.Element {
  const t = useTranslations('forms.builder');
  const { session } = useSession();
  const router = useRouter();
  const init = getFormInit(initial);
  const [name, setName] = useState(init.name);
  const [slug, setSlug] = useState(init.slug);
  const [description, setDescription] = useState(init.description);
  const [notifyEmail, setNotifyEmail] = useState(init.notifyEmail);
  const [isActive, setIsActive] = useState(init.isActive);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<FieldRow[]>(toInitialFields(initial));

  const addField = useCallback((): void => {
    setFields((prev) => [...prev, { ...emptyField(), position: prev.length }]);
  }, []);

  const removeField = useCallback((key: string): void => {
    setFields((prev) => prev.filter((f) => f._key !== key));
  }, []);

  const updateField = useCallback((key: string, patch: Partial<FieldRow>): void => {
    setFields((prev) => prev.map((f) => (f._key === key ? { ...f, ...patch } : f)));
  }, []);

  const handleSave = useCallback(async (): Promise<void> => {
    if (!session) return;
    setSaving(true);
    setError(null);
    try {
      const client = createApiClient(session.accessToken);
      const fieldInputs: FormFieldInput[] = fields.map((f, i) => ({
        name: f.name,
        label: f.label,
        type: f.type,
        isRequired: f.isRequired ?? false,
        position: i,
        config: f.config ?? {},
      }));
      const body = {
        name,
        slug,
        isActive,
        fields: fieldInputs,
        ...(description ? { description } : {}),
        ...(notifyEmail ? { notifyEmail } : {}),
      };
      if (initial) {
        await client.forms.update(initial.id, body);
      } else {
        await client.forms.create(body);
      }
      router.push('/forms');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('saveError'));
    } finally {
      setSaving(false);
    }
  }, [session, name, slug, description, notifyEmail, isActive, fields, initial, router, t]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">
          {initial ? t('editTitle') : t('newTitle')}
        </h2>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              router.push('/forms');
            }}
          >
            {t('cancel')}
          </Button>
          <Button
            disabled={saving}
            onClick={() => {
              void handleSave();
            }}
          >
            {saving ? t('saving') : t('save')}
          </Button>
        </div>
      </div>
      {error && (
        <p className="rounded-md border border-destructive bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="grid gap-4 rounded-lg border p-6 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="form-name">{t('fields.name')}</Label>
          <Input
            id="form-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
            }}
            placeholder={t('fields.namePlaceholder')}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="form-slug">{t('fields.slug')}</Label>
          <Input
            id="form-slug"
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
            }}
            placeholder={t('fields.slugPlaceholder')}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="form-desc">{t('fields.description')}</Label>
          <Input
            id="form-desc"
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
            }}
            placeholder={t('fields.descriptionPlaceholder')}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="form-email">{t('fields.notifyEmail')}</Label>
          <Input
            id="form-email"
            type="email"
            value={notifyEmail}
            onChange={(e) => {
              setNotifyEmail(e.target.value);
            }}
            placeholder={t('fields.notifyEmailPlaceholder')}
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            id="form-active"
            type="checkbox"
            checked={isActive}
            onChange={(e) => {
              setIsActive(e.target.checked);
            }}
            className="h-4 w-4"
          />
          <Label htmlFor="form-active">{t('fields.isActive')}</Label>
        </div>
      </div>
      <FormFieldsSection
        fields={fields}
        onAdd={addField}
        onUpdate={updateField}
        onRemove={removeField}
      />
    </div>
  );
}
