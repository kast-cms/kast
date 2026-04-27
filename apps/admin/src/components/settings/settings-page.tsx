'use client';

import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings } from 'lucide-react';
import type { JSX } from 'react';
import { ContentTab } from './content-tab';
import { EmailTab } from './email-tab';
import { GeneralTab } from './general-tab';
import { SecurityTab } from './security-tab';
import { SeoTab } from './seo-tab';
import { StorageTab } from './storage-tab';
import { useSettings } from './use-settings';

const TABS = [
  { id: 'general', label: 'General' },
  { id: 'email', label: 'Email' },
  { id: 'storage', label: 'Storage' },
  { id: 'security', label: 'Security' },
  { id: 'seo', label: 'SEO' },
  { id: 'content', label: 'Content' },
] as const;

export function SettingsPage(): JSX.Element {
  const s = useSettings();

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <Settings className="size-6 text-[--color-muted-foreground]" />
        <div>
          <h1 className="text-2xl font-semibold">Settings</h1>
          <p className="text-sm text-[--color-muted-foreground]">Configure your KAST instance</p>
        </div>
      </div>

      {s.loading ? (
        <div className="flex items-center gap-2 text-sm text-[--color-muted-foreground]">
          <Spinner className="size-4" /> Loading settings…
        </div>
      ) : (
        <Tabs defaultValue="general" className="space-y-6">
          <TabsList>
            {TABS.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="general">
            <GeneralTab s={s} />
          </TabsContent>
          <TabsContent value="email">
            <EmailTab s={s} />
          </TabsContent>
          <TabsContent value="storage">
            <StorageTab s={s} />
          </TabsContent>
          <TabsContent value="security">
            <SecurityTab s={s} />
          </TabsContent>
          <TabsContent value="seo">
            <SeoTab s={s} />
          </TabsContent>
          <TabsContent value="content">
            <ContentTab s={s} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
