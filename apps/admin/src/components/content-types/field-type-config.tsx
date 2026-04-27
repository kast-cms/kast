'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import type { ContentFieldType } from '@kast/sdk';
import { useCallback, type ChangeEvent, type JSX } from 'react';

interface FieldConfigProps {
  type: ContentFieldType;
  config: Record<string, unknown>;
  onConfigChange: (config: Record<string, unknown>) => void;
}

function TextConfig({
  config,
  set,
}: {
  config: Record<string, unknown>;
  set: (k: string, v: unknown) => void;
}): JSX.Element {
  return (
    <div className="grid gap-y-4">
      <div className="grid gap-y-2">
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
      <div className="grid gap-y-2">
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
      <div className="grid gap-y-2">
        <Label htmlFor="cfg-regex">Regex pattern</Label>
        <Input
          id="cfg-regex"
          placeholder="^[a-z]+$"
          value={typeof config['regex'] === 'string' ? config['regex'] : ''}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            set('regex', e.target.value !== '' ? e.target.value : undefined);
          }}
        />
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
    <div className="grid gap-y-4">
      <div className="grid gap-y-2">
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
      <div className="grid gap-y-2">
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
      <div className="flex items-center justify-between">
        <Label htmlFor="cfg-isInteger">Integer only</Label>
        <Switch
          id="cfg-isInteger"
          checked={config['isInteger'] === true}
          onCheckedChange={(checked) => {
            set('isInteger', checked);
          }}
        />
      </div>
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
    <div className="grid gap-y-4">
      <div className="flex items-center justify-between">
        <Label htmlFor="cfg-multiple">Allow multiple files</Label>
        <Switch
          id="cfg-multiple"
          checked={config['multiple'] === true}
          onCheckedChange={(checked) => {
            set('multiple', checked);
          }}
        />
      </div>
      <div className="grid gap-y-2">
        <Label htmlFor="cfg-mimeTypes">Allowed MIME types</Label>
        <Input
          id="cfg-mimeTypes"
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
        <p className="text-xs text-muted-foreground">Comma-separated. Leave empty to allow all.</p>
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
      <div className="grid gap-y-2">
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

  if (type === 'ENUM') {
    const enumVal = Array.isArray(config['values'])
      ? (config['values'] as string[]).join(', ')
      : '';
    return (
      <div className="grid gap-y-2">
        <Label htmlFor="cfg-values">Enum values</Label>
        <Input
          id="cfg-values"
          placeholder="draft, published, archived"
          value={enumVal}
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
        <p className="text-xs text-muted-foreground">Comma-separated list of allowed values.</p>
      </div>
    );
  }

  if (type === 'UID') {
    return (
      <div className="grid gap-y-2">
        <Label htmlFor="cfg-targetField">Target field (source for UID generation)</Label>
        <Input
          id="cfg-targetField"
          placeholder="title"
          value={typeof config['targetField'] === 'string' ? config['targetField'] : ''}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            set('targetField', e.target.value !== '' ? e.target.value : undefined);
          }}
        />
      </div>
    );
  }

  return null;
}
