'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SeparatorWithLabel } from '@/components/ui/separator';
import { PlugZap, Save } from 'lucide-react';
import { useState, type JSX } from 'react';
import { SettingsField } from './settings-field';
import type { UseSettingsReturn } from './use-settings';

const PROVIDERS = ['LOCAL', 'S3', 'R2', 'MINIO'] as const;
type StorageProvider = (typeof PROVIDERS)[number];

interface Props {
  s: UseSettingsReturn;
}

export function StorageTab({ s }: Props): JSX.Element {
  const [provider, setProvider] = useState<StorageProvider>(
    () => (s.getValue('storage.provider') as StorageProvider | undefined) ?? 'LOCAL',
  );
  const [maxSizeMb, setMaxSizeMb] = useState<string>(() =>
    String(s.getValue('storage.maxFileSizeMb') ?? '10'),
  );
  const [mimeTypes, setMimeTypes] = useState<string>(() => {
    const v = s.getValue('storage.allowedMimeTypes');
    return Array.isArray(v) ? (v as string[]).join(', ') : String(v ?? 'image/*, application/pdf');
  });
  const [testResult, setTestResult] = useState<{ provider: string; status: string } | null>(null);
  const [testing, setTesting] = useState(false);

  const save = async (): Promise<void> => {
    await s.patchSettings([
      { key: 'storage.provider', value: provider },
      { key: 'storage.maxFileSizeMb', value: parseInt(maxSizeMb, 10) },
      { key: 'storage.allowedMimeTypes', value: mimeTypes.split(',').map((m) => m.trim()) },
    ]);
  };

  const runTest = async (): Promise<void> => {
    setTesting(true);
    try {
      const res = await s.testStorage();
      setTestResult(res);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Storage</CardTitle>
          <CardDescription>Where uploaded media is written, and what is accepted.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 pt-4">
          <SettingsField
            label="Storage Provider"
            htmlFor="storage-provider"
            required
            hint="LOCAL keeps files on the API server’s disk; the others write to object storage."
          >
            <Select value={provider} onValueChange={(v) => setProvider(v as StorageProvider)}>
              <SelectTrigger id="storage-provider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROVIDERS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingsField>

          <SeparatorWithLabel>Upload limits</SeparatorWithLabel>

          <SettingsField
            label="Max File Size"
            htmlFor="max-size"
            required
            hint="Applies to a single upload. Larger files are rejected before they are stored."
          >
            <Input
              id="max-size"
              value={maxSizeMb}
              onChange={(e) => setMaxSizeMb(e.target.value)}
              placeholder="10"
              className="pe-12"
              endAdornment={<span className="text-xs font-medium">MB</span>}
            />
          </SettingsField>

          <SettingsField
            label="Allowed MIME Types"
            htmlFor="mime-types"
            hint="Comma-separated. Wildcards such as image/* are allowed."
          >
            <Input
              id="mime-types"
              value={mimeTypes}
              onChange={(e) => setMimeTypes(e.target.value)}
              placeholder="image/*, application/pdf"
              className="font-mono"
            />
          </SettingsField>
        </CardContent>
        <CardFooter className="justify-end">
          <Button
            onClick={() => {
              void save();
            }}
            loading={s.saving}
          >
            {!s.saving && <Save />}
            {s.saving ? 'Saving…' : 'Save Storage'}
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Connection</CardTitle>
          <CardDescription>
            Checks that the saved provider can be reached with the current credentials.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <Button
            variant="outline"
            onClick={() => {
              void runTest();
            }}
            loading={testing}
          >
            {!testing && <PlugZap />}
            {testing ? 'Testing…' : 'Test Connection'}
          </Button>

          {testResult !== null && (
            <Alert variant="success">
              <AlertTitle>{testResult.provider} reachable</AlertTitle>
              <AlertDescription>{testResult.status}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
