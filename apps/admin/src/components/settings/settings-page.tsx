'use client';

import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

/**
 * Mirrors the real layout — a tab bar over a form card — so the page does not
 * reflow once the settings land.
 */
function SettingsSkeleton(): JSX.Element {
  return (
    <div className="space-y-6">
      <div className="flex h-10 items-center gap-6 border-b border-border">
        {TABS.map((tab) => (
          <Skeleton key={tab.id} className="h-3.5 w-14" />
        ))}
      </div>
      <Card className="max-w-3xl">
        <CardHeader>
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-64" />
        </CardHeader>
        <CardContent className="space-y-5 pt-4">
          {[0, 1, 2].map((row) => (
            <div key={row} className="space-y-2">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
        </CardContent>
        <CardFooter className="justify-end">
          <Skeleton className="h-9 w-32" />
        </CardFooter>
      </Card>
    </div>
  );
}

export function SettingsPage(): JSX.Element {
  const s = useSettings();

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Configure your KAST instance" />

      {s.loading ? (
        <SettingsSkeleton />
      ) : (
        <Tabs defaultValue="general" className="gap-6">
          <TabsList variant="underline">
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
