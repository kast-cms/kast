'use client';

import { Input } from '@/components/ui/input';
import { FieldHint, Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import type { ContentFieldType } from '@kast-cms/sdk';
import { useCallback, type ChangeEvent, type JSX, type ReactNode } from 'react';

interface FieldConfigProps {
  type: ContentFieldType;
  config: Record<string, unknown>;
  onConfigChange: (config: Record<string, unknown>) => void;
}

/** A switch and its label on one line, so boolean settings all sit the same way. */
function ToggleRow({
  id,
  label,
  checked,
  onCheckedChange,
}: {
  id: string;
  label: ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-4">
      <Label htmlFor={id} className="cursor-pointer">
        {label}
      </Label>
      <Switch id={id} className="shrink-0" checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function TextConfig({
  config,
  set,
}: {
  config: Record<string, unknown>;
  set: (k: string, v: unknown) => void;
}): JSX.Element {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="cfg-minLength">Min length</Label>
          <Input
            id="cfg-minLength"
            type="number"
            min={0}
            placeholder="0"
            value={typeof config['minLength'] === 'number' ? config['minLength'] : ''}
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              set('minLength', e.target.value !== '' ? Number(e.target.value) : undefined);
            }}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cfg-maxLength">Max length</Label>
          <Input
            id="cfg-maxLength"
            type="number"
            min={1}
            placeholder="255"
            value={typeof config['maxLength'] === 'number' ? config['maxLength'] : ''}
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              set('maxLength', e.target.value !== '' ? Number(e.target.value) : undefined);
            }}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="cfg-regex">Regex pattern</Label>
        <Input
          id="cfg-regex"
          className="font-mono"
          placeholder="^[a-z]+$"
          value={typeof config['regex'] === 'string' ? config['regex'] : ''}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            set('regex', e.target.value !== '' ? e.target.value : undefined);
          }}
        />
        <FieldHint>Values that do not match are rejected on save.</FieldHint>
      </div>
    </div>
  );
}

function NumberConfig({
  config,
  set,
}: {
  config: Record<string, unknown>;
  set: (k: string, v: unknown) => void;
}): JSX.Element {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="cfg-min">Min value</Label>
          <Input
            id="cfg-min"
            type="number"
            value={typeof config['min'] === 'number' ? config['min'] : ''}
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              set('min', e.target.value !== '' ? Number(e.target.value) : undefined);
            }}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cfg-max">Max value</Label>
          <Input
            id="cfg-max"
            type="number"
            value={typeof config['max'] === 'number' ? config['max'] : ''}
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              set('max', e.target.value !== '' ? Number(e.target.value) : undefined);
            }}
          />
        </div>
      </div>
      <ToggleRow
        id="cfg-isInteger"
        label="Integer only"
        checked={config['isInteger'] === true}
        onCheckedChange={(checked) => {
          set('isInteger', checked);
        }}
      />
    </div>
  );
}

function MediaConfig({
  config,
  set,
}: {
  config: Record<string, unknown>;
  set: (k: string, v: unknown) => void;
}): JSX.Element {
  const mimeVal = Array.isArray(config['allowedMimeTypes'])
    ? (config['allowedMimeTypes'] as string[]).join(', ')
    : '';
  return (
    <div className="space-y-4">
      <ToggleRow
        id="cfg-multiple"
        label="Allow multiple files"
        checked={config['multiple'] === true}
        onCheckedChange={(checked) => {
          set('multiple', checked);
        }}
      />
      <div className="space-y-2">
        <Label htmlFor="cfg-mimeTypes">Allowed MIME types</Label>
        <Input
          id="cfg-mimeTypes"
          className="font-mono"
          placeholder="image/jpeg, image/png"
          value={mimeVal}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            const vals = e.target.value
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean);
            set('allowedMimeTypes', vals.length > 0 ? vals : undefined);
          }}
        />
        <FieldHint>Comma-separated. Leave empty to allow all.</FieldHint>
      </div>
    </div>
  );
}

export function FieldTypeConfig({
  type,
  config,
  onConfigChange,
}: FieldConfigProps): JSX.Element | null {
  const set = useCallback(
    (key: string, value: unknown) => {
      onConfigChange({ ...config, [key]: value });
    },
    [config, onConfigChange],
  );

  if (type === 'TEXT') return <TextConfig config={config} set={set} />;
  if (type === 'NUMBER') return <NumberConfig config={config} set={set} />;
  if (type === 'MEDIA') return <MediaConfig config={config} set={set} />;

  if (type === 'DATE') {
    return (
      <div className="space-y-2">
        <Label htmlFor="cfg-variant">Date variant</Label>
        <Select
          value={typeof config['variant'] === 'string' ? config['variant'] : 'date'}
          onValueChange={(v) => {
            set('variant', v);
          }}
        >
          <SelectTrigger id="cfg-variant">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date">Date only</SelectItem>
            <SelectItem value="datetime">Date &amp; time</SelectItem>
            <SelectItem value="time">Time only</SelectItem>
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (type === 'SELECT' || type === 'MULTI_SELECT') {
    const choices = Array.isArray(config['values'])
      ? (config['values'] as string[]).join(', ')
      : '';
    return (
      <div className="space-y-2">
        <Label htmlFor="cfg-values">Choices</Label>
        <Input
          id="cfg-values"
          className="font-mono"
          placeholder="draft, published, archived"
          value={choices}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            set(
              'values',
              e.target.value
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            );
          }}
        />
        <FieldHint>
          Comma-separated list of allowed values. The API rejects any value outside this list.
        </FieldHint>
      </div>
    );
  }

  // Every other type is configuration-free. Say so, rather than leaving the
  // panel that wraps this component looking like it failed to render.
  return <p className="text-sm text-muted-foreground">This field type has no extra settings.</p>;
}
