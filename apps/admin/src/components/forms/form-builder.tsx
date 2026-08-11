'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/ui/page-header';
import { Switch } from '@/components/ui/switch';
import { clearable } from '@/lib/nullable-field';
import { useApiClient, useSession } from '@/lib/session';
import type { FormDetail, FormFieldInput } from '@kast-cms/sdk';
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

interface FormMetaSectionProps {
  name: string;
  slug: string;
  description: string;
  notifyEmail: string;
  isActive: boolean;
  t: ReturnType<typeof useTranslations<'forms.builder'>>;
  setName: (v: string) => void;
  setSlug: (v: string) => void;
  setDescription: (v: string) => void;
  setNotifyEmail: (v: string) => void;
  setIsActive: (v: boolean) => void;
}

function FormMetaSection({
  name,
  slug,
  description,
  notifyEmail,
  isActive,
  t,
  setName,
  setSlug,
  setDescription,
  setNotifyEmail,
  setIsActive,
}: FormMetaSectionProps): JSX.Element {
  return (
    <Card>
      <CardContent className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
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
              className="font-mono text-xs"
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
        </div>

        <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3">
          <Switch
            id="form-active"
            checked={isActive}
            onCheckedChange={(checked) => {
              setIsActive(checked);
            }}
          />
          <Label htmlFor="form-active" className="cursor-pointer">
            {t('fields.isActive')}
          </Label>
        </div>
      </CardContent>
    </Card>
  );
}

interface FormBuilderProps {
  initial?: FormDetail;
}

export function FormBuilder({ initial }: FormBuilderProps): JSX.Element {
  const client = useApiClient();
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
      const fieldInputs: FormFieldInput[] = fields.map((f, i) => ({
        name: f.name,
        label: f.label,
        type: f.type,
        isRequired: f.isRequired ?? false,
        position: i,
        config: f.config ?? {},
      }));
      // Blank means "no notification/description", which only reaches the API as
      // an explicit null — an omitted key leaves the stored value in place, so
      // the form would keep mailing submissions to the removed address.
      const body = {
        name,
        slug,
        isActive,
        fields: fieldInputs,
        description: clearable(description),
        notifyEmail: clearable(notifyEmail),
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
  }, [session, name, slug, description, notifyEmail, isActive, fields, initial, router, t, client]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={initial ? t('editTitle') : t('newTitle')}
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => {
                router.push('/forms');
              }}
            >
              {t('cancel')}
            </Button>
            <Button
              loading={saving}
              onClick={() => {
                void handleSave();
              }}
            >
              {saving ? t('saving') : t('save')}
            </Button>
          </>
        }
      />

      {error !== null && (
        <Alert variant="destructive">
          <AlertTitle>{t('saveError')}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <FormMetaSection
        name={name}
        slug={slug}
        description={description}
        notifyEmail={notifyEmail}
        isActive={isActive}
        t={t}
        setName={setName}
        setSlug={setSlug}
        setDescription={setDescription}
        setNotifyEmail={setNotifyEmail}
        setIsActive={setIsActive}
      />

      <FormFieldsSection
        fields={fields}
        onAdd={addField}
        onUpdate={updateField}
        onRemove={removeField}
      />
    </div>
  );
}
