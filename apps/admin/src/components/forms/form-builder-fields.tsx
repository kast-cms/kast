'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Hint } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { GripVertical, ListPlus, Plus, Trash2 } from 'lucide-react';
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

/**
 * A field type is a category, not a status — an email field is not "info" and a
 * date field is not "warning" — so the dots draw from the categorical chart ramp.
 * Related types share a hue so the list reads in families.
 */
const FIELD_TYPE_DOT: Record<FieldType, string> = {
  TEXT: 'bg-chart-1',
  TEXTAREA: 'bg-chart-1',
  EMAIL: 'bg-chart-2',
  PHONE: 'bg-chart-2',
  NUMBER: 'bg-chart-4',
  DATE: 'bg-chart-4',
  SELECT: 'bg-chart-3',
  MULTI_SELECT: 'bg-chart-3',
  RADIO: 'bg-chart-3',
  CHECKBOX: 'bg-chart-6',
  FILE: 'bg-chart-5',
};

export interface FieldRow {
  _key: string;
  name: string;
  label: string;
  type: FieldType;
  isRequired?: boolean;
  position: number;
  config?: Record<string, unknown>;
}

function TypeDot({ type }: { type: FieldType }): JSX.Element {
  return (
    <span
      aria-hidden="true"
      className={cn('size-1.5 shrink-0 rounded-full', FIELD_TYPE_DOT[type])}
    />
  );
}

interface FieldItemProps {
  field: FieldRow;
  onUpdate: (key: string, patch: Partial<FieldRow>) => void;
  onRemove: (key: string) => void;
}

function FieldItem({ field, onUpdate, onRemove }: FieldItemProps): JSX.Element {
  const t = useTranslations('forms.builder');
  const tc = useTranslations('common');
  const idBase = `form-field-${field._key}`;

  return (
    <div
      className={cn(
        'group relative flex items-start gap-3 rounded-lg border border-border bg-card px-3 py-3 shadow-2xs',
        'transition-[border-color,background-color,box-shadow] duration-150 ease-out-quad',
        'hover:border-border-strong hover:bg-accent/40',
        'focus-within:border-ring/50 focus-within:bg-card focus-within:shadow-sm',
      )}
    >
      <GripVertical
        aria-hidden="true"
        className="size-4 shrink-0 text-muted-foreground/60 transition-colors duration-150 group-hover:text-muted-foreground md:mt-8"
      />

      <div className="grid min-w-0 flex-1 gap-3 md:grid-cols-4">
        <div className="min-w-0 space-y-1.5">
          <Label htmlFor={`${idBase}-name`} className="text-xs text-muted-foreground">
            {t('fieldLabel.name')}
          </Label>
          <Input
            id={`${idBase}-name`}
            value={field.name}
            onChange={(e) => {
              onUpdate(field._key, { name: e.target.value });
            }}
            placeholder={t('fieldLabel.namePlaceholder')}
            className="h-8 font-mono text-xs"
          />
        </div>

        <div className="min-w-0 space-y-1.5">
          <Label htmlFor={`${idBase}-label`} className="text-xs text-muted-foreground">
            {t('fieldLabel.label')}
          </Label>
          <Input
            id={`${idBase}-label`}
            value={field.label}
            onChange={(e) => {
              onUpdate(field._key, { label: e.target.value });
            }}
            placeholder={t('fieldLabel.labelPlaceholder')}
            className="h-8 text-sm"
          />
        </div>

        <div className="min-w-0 space-y-1.5">
          <Label htmlFor={`${idBase}-type`} className="text-xs text-muted-foreground">
            {t('fieldLabel.type')}
          </Label>
          {/* The dot is layered over the trigger rather than nested inside it, so
              the trigger's own line-clamp rules keep working on the value span. */}
          <div className="relative">
            <span
              aria-hidden="true"
              className={cn(
                'pointer-events-none absolute top-1/2 start-2.5 z-10 size-1.5 -translate-y-1/2 rounded-full',
                FIELD_TYPE_DOT[field.type],
              )}
            />
            <Select
              value={field.type}
              onValueChange={(value) => {
                onUpdate(field._key, { type: value as FieldType });
              }}
            >
              <SelectTrigger id={`${idBase}-type`} size="sm" className="ps-6 font-mono text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FIELD_TYPES.map((ft) => (
                  <SelectItem key={ft} value={ft} className="font-mono text-xs">
                    <span className="flex items-center gap-2">
                      <TypeDot type={ft} />
                      {ft}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-2 md:self-end md:pb-2">
          <Checkbox
            id={`${idBase}-required`}
            checked={field.isRequired ?? false}
            onCheckedChange={(checked) => {
              onUpdate(field._key, { isRequired: checked === true });
            }}
          />
          <Label htmlFor={`${idBase}-required`} className="text-xs">
            {t('fieldLabel.required')}
          </Label>
        </div>
      </div>

      <Hint label={tc('delete')}>
        <Button
          size="icon-sm"
          variant="ghost-destructive"
          aria-label={tc('delete')}
          className="shrink-0 md:mt-6"
          onClick={() => {
            onRemove(field._key);
          }}
        >
          <Trash2 />
        </Button>
      </Hint>
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {t('fieldsSection')}
          <Badge variant="muted" size="sm">
            {fields.length}
          </Badge>
        </CardTitle>
        <CardAction>
          <Button size="sm" onClick={onAdd}>
            <Plus />
            {t('addField')}
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent>
        {fields.length === 0 ? (
          <EmptyState
            Icon={ListPlus}
            size="sm"
            title={t('fieldsSection')}
            description={t('noFields')}
            action={
              <Button size="sm" variant="outline" onClick={onAdd}>
                <Plus />
                {t('addField')}
              </Button>
            }
          />
        ) : (
          <div className="flex flex-col gap-2">
            {fields.map((field) => (
              <FieldItem key={field._key} field={field} onUpdate={onUpdate} onRemove={onRemove} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
