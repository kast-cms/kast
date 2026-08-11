'use client';

import { useApiClient, useSession } from '@/lib/session';
import type { CreateMenuItemBody, MenuItemSummary, UpdateMenuItemBody } from '@kast-cms/sdk';
import { useCallback, useState } from 'react';

interface UseMenuItemsResult {
  items: MenuItemSummary[];
  itemSaving: boolean;
  refreshItems: (id: string) => Promise<void>;
  handleAddItem: (menuId: string, body: CreateMenuItemBody, parentId?: string) => Promise<void>;
  handleDeleteItem: (menuId: string, itemId: string) => Promise<void>;
  handleEditItem: (menuId: string, itemId: string, body: UpdateMenuItemBody) => Promise<void>;
}

export function useMenuItems(initial: MenuItemSummary[] = []): UseMenuItemsResult {
  const client = useApiClient();
  const { session } = useSession();
  const [items, setItems] = useState<MenuItemSummary[]>(initial);
  const [itemSaving, setItemSaving] = useState(false);

  const refreshItems = useCallback(
    async (id: string): Promise<void> => {
      if (!session) return;
      const fresh = await client.menus.findOne(id);
      setItems(fresh.items);
    },
    [session, client],
  );

  const handleAddItem = useCallback(
    async (menuId: string, body: CreateMenuItemBody, parentId?: string): Promise<void> => {
      if (!session) return;
      setItemSaving(true);
      try {
        await client.menus.addItem(menuId, { ...body, ...(parentId ? { parentId } : {}) });
        await refreshItems(menuId);
      } finally {
        setItemSaving(false);
      }
    },
    [session, refreshItems, client],
  );

  const handleDeleteItem = useCallback(
    async (menuId: string, itemId: string): Promise<void> => {
      if (!session) return;
      await client.menus.deleteItem(menuId, itemId);
      await refreshItems(menuId);
    },
    [session, refreshItems, client],
  );

  const handleEditItem = useCallback(
    async (menuId: string, itemId: string, body: UpdateMenuItemBody): Promise<void> => {
      if (!session) return;
      setItemSaving(true);
      try {
        await client.menus.updateItem(menuId, itemId, body);
        await refreshItems(menuId);
      } finally {
        setItemSaving(false);
      }
    },
    [session, refreshItems, client],
  );

  return { items, itemSaving, refreshItems, handleAddItem, handleDeleteItem, handleEditItem };
}
