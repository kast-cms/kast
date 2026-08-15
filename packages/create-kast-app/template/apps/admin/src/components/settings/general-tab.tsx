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
import { SeparatorWithLabel } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Globe, Save } from 'lucide-react';
import { useState, type JSX } from 'react';
import { SettingsField, SettingsToggleField } from './settings-field';
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
      { key: 'site.name', value: siteName, isPublic: true },
      { key: 'site.url', value: siteUrl, isPublic: true },
      { key: 'site.maintenanceMode', value: maintenanceMode },
    ]);
  };

  return (
    <div className="max-w-3xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Site</CardTitle>
          <CardDescription>
            How this instance identifies itself to visitors and in outgoing links.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 pt-4">
          <SettingsField
            label="Site Name"
            htmlFor="site-name"
            required
            hint="Used wherever the instance names itself, such as email subjects."
          >
            <Input
              id="site-name"
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
              placeholder="My CMS"
            />
          </SettingsField>

          <SettingsField
            label="Site URL"
            htmlFor="site-url"
            required
            hint="Public origin of the front end, without a trailing slash."
          >
            <Input
              id="site-url"
              value={siteUrl}
              onChange={(e) => setSiteUrl(e.target.value)}
              placeholder="https://example.com"
              startAdornment={<Globe />}
            />
          </SettingsField>

          <SeparatorWithLabel>Availability</SeparatorWithLabel>

          <SettingsToggleField
            label="Maintenance Mode"
            htmlFor="maintenance-mode"
            hint="Public delivery routes return 503. The admin panel stays reachable."
            control={
              <Switch
                id="maintenance-mode"
                checked={maintenanceMode}
                onCheckedChange={setMaintenanceMode}
              />
            }
          />

          {maintenanceMode && (
            <Alert variant="warning">
              <AlertTitle>Maintenance mode will be enabled</AlertTitle>
              <AlertDescription>
                Once saved, requests to the public delivery API stop being served until you turn
                this back off.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
        <CardFooter className="justify-end">
          <Button
            onClick={() => {
              void save();
            }}
            loading={s.saving}
          >
            {!s.saving && <Save />}
            {s.saving ? 'Saving…' : 'Save General'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
