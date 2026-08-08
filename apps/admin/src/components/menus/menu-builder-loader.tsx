'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { createApiClient } from '@/lib/api';
import { useSession } from '@/lib/session';
import type { MenuDetail } from '@kast-cms/sdk';
import { useTranslations } from 'next-intl';
import { useEffect, useState, type JSX } from 'react';
import { MenuBuilder } from './menu-builder';

interface Props {
  menuId: string;
}

export function MenuBuilderLoader({ menuId }: Props): JSX.Element {
  const t = useTranslations('menus');
  const { session } = useSession();
  const [menu, setMenu] = useState<MenuDetail | null>(null);

  useEffect(() => {
    if (!session) return;
    const client = createApiClient(session.accessToken);
    void client.menus.findOne(menuId).then(setMenu);
  }, [session, menuId]);

  if (!menu) {
    // Mirrors the builder's own layout so the screen settles instead of jumping.
    return (
      <div className="mx-auto max-w-3xl space-y-6" aria-busy="true">
        <p role="status" className="sr-only">
          {t('loading')}
        </p>
        <div className="flex items-start justify-between gap-6">
          <Skeleton className="h-7 w-40" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-24 rounded-md" />
            <Skeleton className="h-9 w-24 rounded-md" />
          </div>
        </div>
        <Card>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 2 }, (_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-9 w-full rounded-md" />
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-lg" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return <MenuBuilder initial={menu} />;
}
