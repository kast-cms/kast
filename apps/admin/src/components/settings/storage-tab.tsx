'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CheckCircle, Save } from 'lucide-react';
import { useState, type JSX } from 'react';
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
    <div className="space-y-6 max-w-lg">
      <div className="space-y-2">
        <Label>Storage Provider</Label>
        <Select value={provider} onValueChange={(v) => setProvider(v as StorageProvider)}>
          <SelectTrigger>
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
      </div>
      <div className="space-y-2">
        <Label htmlFor="max-size">Max File Size (MB)</Label>
        <Input
          id="max-size"
          value={maxSizeMb}
          onChange={(e) => setMaxSizeMb(e.target.value)}
          placeholder="10"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="mime-types">Allowed MIME Types (comma-separated)</Label>
        <Input
          id="mime-types"
          value={mimeTypes}
          onChange={(e) => setMimeTypes(e.target.value)}
          placeholder="image/*, application/pdf"
        />
      </div>
      <div className="flex gap-2">
        <Button
          onClick={() => {
            void save();
          }}
          disabled={s.saving}
          className="flex items-center gap-2"
        >
          <Save className="size-4" />
          {s.saving ? 'Saving…' : 'Save Storage'}
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            void runTest();
          }}
          disabled={testing}
          className="flex items-center gap-2 bg-white text-gray-700 border-gray-300 hover:bg-gray-100 hover:text-gray-900"
        >
          {testing ? 'Testing…' : 'Test Connection'}
        </Button>
      </div>
      {testResult !== null && (
        <p className="flex items-center gap-2 text-sm text-green-600">
          <CheckCircle className="size-4" /> {testResult.provider}: {testResult.status}
        </p>
      )}
    </div>
  );
}
