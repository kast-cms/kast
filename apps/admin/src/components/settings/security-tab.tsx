'use client';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { SeparatorWithLabel } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Save } from 'lucide-react';
import { useState, type JSX } from 'react';
import { SettingsField } from './settings-field';
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

  const originCount = corsOrigins
    .split('\n')
    .map((o) => o.trim())
    .filter(Boolean).length;

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
    <div className="max-w-3xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Access</CardTitle>
          <CardDescription>
            Which browsers may call the API, and what crawlers are told about the site.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 pt-4">
          <SettingsField
            label="Allowed CORS Origins"
            htmlFor="cors-origins"
            hint={
              originCount === 0
                ? 'One origin per line. With none listed, cross-origin browser calls are blocked.'
                : `One origin per line. ${String(originCount)} configured.`
            }
          >
            <Textarea
              id="cors-origins"
              rows={5}
              value={corsOrigins}
              onChange={(e) => setCorsOrigins(e.target.value)}
              placeholder="https://example.com"
              className="font-mono"
            />
          </SettingsField>

          <SeparatorWithLabel>Crawlers</SeparatorWithLabel>

          <SettingsField
            label="robots.txt content"
            htmlFor="robots-txt"
            hint="Served verbatim. Standard robots.txt directives, one per line."
          >
            <Textarea
              id="robots-txt"
              rows={6}
              value={robotsTxt}
              onChange={(e) => setRobotsTxt(e.target.value)}
              className="font-mono text-sm"
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
            {s.saving ? 'Saving…' : 'Save Security'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
