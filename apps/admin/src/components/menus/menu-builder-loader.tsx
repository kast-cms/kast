'use client';

import { createApiClient } from '@/lib/api';
import { useSession } from '@/lib/session';
import type { MenuDetail } from '@kast/sdk';
import { useEffect, useState, type JSX } from 'react';
import { MenuBuilder } from './menu-builder';

interface Props {
  menuId: string;
}

export function MenuBuilderLoader({ menuId }: Props): JSX.Element {
  const { session } = useSession();
  const [menu, setMenu] = useState<MenuDetail | null>(null);

  useEffect(() => {
    if (!session) return;
    const client = createApiClient(session.accessToken);
    void client.menus.findOne(menuId).then(setMenu);
  }, [session, menuId]);

  if (!menu) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">Loading…</div>
    );
  }

  return <MenuBuilder initial={menu} />;
}
