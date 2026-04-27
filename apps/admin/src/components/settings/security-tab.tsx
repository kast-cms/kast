'use client';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Save } from 'lucide-react';
import { useState, type JSX } from 'react';
import type { UseSettingsReturn } from './use-settings';

interface Props {
  s: UseSettingsReturn;
}

export function SecurityTab({ s }: Props): JSX.Element {
  const [corsOrigins, setCorsOrigins] = useState<string>(() => {
    const v = s.getValue('cors.allowedOrigins');
    return Array.isArray(v) ? (v as string[]).join('\n') : String(v ?? '');
  });
  const [robotsTxt, setRobotsTxt] = useState<string>(() =>
    String(s.getValue('robots.txt') ?? 'User-agent: *\nAllow: /'),
  );

  const save = async (): Promise<void> => {
    await s.patchSettings([
      {
        key: 'cors.allowedOrigins',
        value: corsOrigins
          .split('\n')
          .map((o) => o.trim())
          .filter(Boolean),
      },
      { key: 'robots.txt', value: robotsTxt },
    ]);
  };

  return (
    <div className="space-y-6 max-w-lg">
      <div className="space-y-2">
        <Label htmlFor="cors-origins">Allowed CORS Origins (one per line)</Label>
        <Textarea
          id="cors-origins"
          rows={5}
          value={corsOrigins}
          onChange={(e) => setCorsOrigins(e.target.value)}
          placeholder="https://example.com"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="robots-txt">robots.txt content</Label>
        <Textarea
          id="robots-txt"
          rows={6}
          value={robotsTxt}
          onChange={(e) => setRobotsTxt(e.target.value)}
          className="font-mono text-sm"
        />
      </div>
      <Button
        onClick={() => {
          void save();
        }}
        disabled={s.saving}
        className="flex items-center gap-2"
      >
        <Save className="size-4" />
        {s.saving ? 'Saving…' : 'Save Security'}
      </Button>
    </div>
  );
}
