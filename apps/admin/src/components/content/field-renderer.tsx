'use client';

import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { ContentField } from '@kast-cms/sdk';
import type { JSONContent } from '@tiptap/react';
import type { JSX } from 'react';
import { RichTextEditor } from './rich-text-editor';

interface FieldRendererProps {
  field: ContentField;
  value: unknown;
  onChange: (val: unknown) => void;
  disabled?: boolean;
}

function asString(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function asNumber(v: unknown): string {
  return typeof v === 'number' ? String(v) : '';
}

function asBool(v: unknown): boolean {
  return v === true;
}

/**
 * Choice lists are stored under whichever key wrote them: the field editor
 * writes `values`, older definitions used `options`, and the API's config
 * reader accepts `options | values | choices`. Read all three so a list saved
 * in one place is never invisible in the other.
 */
function asChoices(field: ContentField): string[] {
  const cfg = field.config as {
    options?: unknown;
    values?: unknown;
    choices?: unknown;
  };
  for (const candidate of [cfg.values, cfg.options, cfg.choices]) {
    if (Array.isArray(candidate)) {
      return candidate.filter((v): v is string => typeof v === 'string');
    }
  }
  return [];
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((item): item is string => typeof item === 'string') : [];
}

function getJsonRaw(value: unknown): string {
  if (typeof value === 'string') return value;
  return JSON.stringify(value ?? '', null, 2);
}

function getTextInputType(type: string): 'text' | 'email' | 'url' {
  if (type === 'EMAIL') return 'email';
  if (type === 'URL') return 'url';
  return 'text';
}

/** Single-choice picker backed by the field's configured choice list. */
function SelectField({ field, value, onChange, disabled }: FieldRendererProps): JSX.Element {
  return (
    <Select
      value={asString(value)}
      onValueChange={(v) => {
        onChange(v);
      }}
      {...(disabled !== undefined ? { disabled } : {})}
    >
      <SelectTrigger>
        <SelectValue placeholder="Select option…" />
      </SelectTrigger>
      <SelectContent>
        {asChoices(field).map((opt) => (
          <SelectItem key={opt} value={opt}>
            {opt}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * Multi-choice picker. Emits a string[], which is what the API's
 * MULTI_SELECT validator expects — a comma-joined string would be rejected.
 */
function MultiSelectField({ field, value, onChange, disabled }: FieldRendererProps): JSX.Element {
  const selected = asStringArray(value);
  const choices = asChoices(field);

  if (choices.length === 0) {
    return <p className="text-sm text-muted-foreground">No choices configured for this field.</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {choices.map((opt) => {
        const isOn = selected.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            disabled={disabled}
            aria-pressed={isOn}
            onClick={() => {
              onChange(isOn ? selected.filter((s) => s !== opt) : [...selected, opt]);
            }}
            className={cn(
              'rounded-md border px-2.5 py-1 text-sm transition-colors duration-150',
              'disabled:cursor-not-allowed disabled:opacity-50',
              isOn
                ? 'border-primary bg-primary-subtle text-primary-subtle-foreground'
                : 'border-border text-muted-foreground hover:bg-muted',
            )}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

/** The types that render as a plain input; split out to keep the dispatch simple. */
function ScalarField({ field, value, onChange, disabled }: FieldRendererProps): JSX.Element {
  const { type } = field;

  if (type === 'NUMBER') {
    return (
      <Input
        type="number"
        value={asNumber(value)}
        onChange={(e) => {
          onChange(e.target.valueAsNumber);
        }}
        disabled={disabled}
      />
    );
  }

  // DATE is date-only; DATETIME carries a time component. Emitting a full
  // timestamp for a DATE field is accepted by the API but loses the distinction
  // the field definition is making.
  if (type === 'DATE' || type === 'DATETIME') {
    return (
      <Input
        type={type === 'DATE' ? 'date' : 'datetime-local'}
        value={asString(value)}
        onChange={(e) => {
          onChange(e.target.value);
        }}
        disabled={disabled}
      />
    );
  }

  if (type === 'COLOR') {
    return (
      <Input
        type="color"
        className="h-9 w-16 p-1"
        value={asString(value) !== '' ? asString(value) : '#000000'}
        onChange={(e) => {
          onChange(e.target.value);
        }}
        disabled={disabled}
      />
    );
  }

  if (type === 'JSON') {
    return (
      <Textarea
        value={getJsonRaw(value)}
        rows={6}
        spellCheck={false}
        className="min-h-32 font-mono text-xs leading-relaxed"
        onChange={(e) => {
          onChange(e.target.value);
        }}
        disabled={disabled}
      />
    );
  }

  return (
    <Input
      type={getTextInputType(type)}
      value={asString(value)}
      onChange={(e) => {
        onChange(e.target.value);
      }}
      disabled={disabled}
    />
  );
}

export function FieldRenderer(props: FieldRendererProps): JSX.Element {
  const { field, value, onChange, disabled } = props;
  const { type } = field;

  if (type === 'RICH_TEXT') {
    return (
      <RichTextEditor
        value={value as JSONContent | null}
        onChange={(v) => {
          onChange(v);
        }}
        {...(disabled !== undefined ? { disabled } : {})}
      />
    );
  }

  if (type === 'BOOLEAN') {
    return (
      <Switch
        checked={asBool(value)}
        onCheckedChange={(checked) => {
          onChange(checked);
        }}
        disabled={disabled}
      />
    );
  }

  if (type === 'SELECT') {
    return (
      <SelectField
        field={field}
        value={value}
        onChange={onChange}
        {...(disabled !== undefined ? { disabled } : {})}
      />
    );
  }

  if (type === 'MULTI_SELECT') {
    return (
      <MultiSelectField
        field={field}
        value={value}
        onChange={onChange}
        {...(disabled !== undefined ? { disabled } : {})}
      />
    );
  }

  return <ScalarField {...props} />;
}
