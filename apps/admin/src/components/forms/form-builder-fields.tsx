'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GripVertical, Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { JSX } from 'react';

export const FIELD_TYPES = [
  'TEXT',
  'EMAIL',
  'PHONE',
  'NUMBER',
  'TEXTAREA',
  'SELECT',
  'MULTI_SELECT',
  'CHECKBOX',
  'RADIO',
  'FILE',
  'DATE',
] as const;

export type FieldType = (typeof FIELD_TYPES)[number];

export interface FieldRow {
  _key: string;
  name: string;
  label: string;
  type: FieldType;
  isRequired?: boolean;
  position: number;
  config?: Record<string, unknown>;
}

interface FieldItemProps {
  field: FieldRow;
  onUpdate: (key: string, patch: Partial<FieldRow>) => void;
  onRemove: (key: string) => void;
}

function FieldItem({ field, onUpdate, onRemove }: FieldItemProps): JSX.Element {
  const t = useTranslations('forms.builder');
  return (
    <div className="flex items-start gap-3 rounded-lg border p-4">
      <GripVertical className="mt-1 h-4 w-4 flex-shrink-0 text-muted-foreground" />
      <div className="grid flex-1 gap-3 md:grid-cols-4">
        <div className="space-y-1">
          <Label className="text-xs">{t('fieldLabel.name')}</Label>
          <Input
            value={field.name}
            onChange={(e) => {
              onUpdate(field._key, { name: e.target.value });
            }}
            placeholder={t('fieldLabel.namePlaceholder')}
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t('fieldLabel.label')}</Label>
          <Input
            value={field.label}
            onChange={(e) => {
              onUpdate(field._key, { label: e.target.value });
            }}
            placeholder={t('fieldLabel.labelPlaceholder')}
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t('fieldLabel.type')}</Label>
          <select
            value={field.type}
            onChange={(e) => {
              onUpdate(field._key, { type: e.target.value as FieldType });
            }}
            className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
          >
            {FIELD_TYPES.map((ft) => (
              <option key={ft} value={ft}>
                {ft}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-1.5 text-xs">
            <input
              type="checkbox"
              checked={field.isRequired ?? false}
              onChange={(e) => {
                onUpdate(field._key, { isRequired: e.target.checked });
              }}
              className="h-3.5 w-3.5"
            />
            {t('fieldLabel.required')}
          </label>
        </div>
      </div>
      <Button
        size="sm"
        variant="ghost"
        className="text-destructive hover:bg-destructive/10"
        onClick={() => {
          onRemove(field._key);
        }}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

interface FormFieldsSectionProps {
  fields: FieldRow[];
  onAdd: () => void;
  onUpdate: (key: string, patch: Partial<FieldRow>) => void;
  onRemove: (key: string) => void;
}

export function FormFieldsSection({
  fields,
  onAdd,
  onUpdate,
  onRemove,
}: FormFieldsSectionProps): JSX.Element {
  const t = useTranslations('forms.builder');
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{t('fieldsSection')}</h3>
        <Button size="sm" onClick={onAdd}>
          <Plus className="mr-2 h-4 w-4" />
          {t('addField')}
        </Button>
      </div>
      {fields.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">{t('noFields')}</p>
      )}
      <div className="space-y-3">
        {fields.map((field) => (
          <FieldItem key={field._key} field={field} onUpdate={onUpdate} onRemove={onRemove} />
        ))}
      </div>
    </div>
  );
}
