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
import type { ContentField } from '@kast/sdk';
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

function asEnumOptions(field: ContentField): string[] {
  const cfg = field.config as { options?: string[] };
  return cfg.options ?? [];
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

export function FieldRenderer({
  field,
  value,
  onChange,
  disabled,
}: FieldRendererProps): JSX.Element {
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

  if (type === 'DATE') {
    return (
      <Input
        type="datetime-local"
        value={asString(value)}
        onChange={(e) => {
          onChange(e.target.value);
        }}
        disabled={disabled}
      />
    );
  }

  if (type === 'ENUM') {
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
          {asEnumOptions(field).map((opt) => (
            <SelectItem key={opt} value={opt}>
              {opt}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (type === 'JSON') {
    return (
      <Textarea
        value={getJsonRaw(value)}
        rows={6}
        className="font-mono text-xs"
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
