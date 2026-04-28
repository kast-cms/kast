'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Save } from 'lucide-react';
import { useState, type JSX } from 'react';
import type { UseSettingsReturn } from './use-settings';

interface Props {
  s: UseSettingsReturn;
}

export function GeneralTab({ s }: Props): JSX.Element {
  const [siteName, setSiteName] = useState<string>(() => String(s.getValue('site.name') ?? ''));
  const [siteUrl, setSiteUrl] = useState<string>(() => String(s.getValue('site.url') ?? ''));
  const [maintenanceMode, setMaintenanceMode] = useState<boolean>(
    () => s.getValue('site.maintenanceMode') === true,
  );

  const save = async (): Promise<void> => {
    await s.patchSettings([
      { key: 'site.name', value: siteName },
      { key: 'site.url', value: siteUrl },
      { key: 'site.maintenanceMode', value: maintenanceMode },
    ]);
  };

  return (
    <div className="space-y-6 max-w-lg">
      <div className="space-y-2">
        <Label htmlFor="site-name">Site Name</Label>
        <Input
          id="site-name"
          value={siteName}
          onChange={(e) => setSiteName(e.target.value)}
          placeholder="My CMS"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="site-url">Site URL</Label>
        <Input
          id="site-url"
          value={siteUrl}
          onChange={(e) => setSiteUrl(e.target.value)}
          placeholder="https://example.com"
        />
      </div>
      <div className="flex items-center gap-3">
        <Switch
          id="maintenance-mode"
          checked={maintenanceMode}
          onCheckedChange={setMaintenanceMode}
        />
        <Label htmlFor="maintenance-mode">Maintenance Mode</Label>
      </div>
      <Button
        onClick={() => {
          void save();
        }}
        disabled={s.saving}
        className="flex items-center gap-2"
      >
        <Save className="size-4" />
        {s.saving ? 'Saving…' : 'Save General'}
      </Button>
    </div>
  );
}
