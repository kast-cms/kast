'use client';

import { createApiClient } from '@/lib/api';
import { useSession } from '@/lib/session';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

interface UseMenuSaveResult {
  menuId: string;
  saving: boolean;
  saveError: string;
  name: string;
  slug: string;
  setName: (v: string) => void;
  setSlug: (v: string) => void;
  handleSave: () => void;
}

export function useMenuSave(initial?: {
  id: string;
  name: string;
  slug: string;
}): UseMenuSaveResult {
  const t = useTranslations('menus');
  const { session } = useSession();
  const router = useRouter();

  const [menuId, setMenuId] = useState(initial?.id ?? '');
  const [name, setName] = useState(initial?.name ?? '');
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const save = useCallback(async (): Promise<void> => {
    if (!session) return;
    setSaving(true);
    setSaveError('');
    try {
      const client = createApiClient(session.accessToken);
      if (menuId) {
        await client.menus.update(menuId, { name, slug });
      } else {
        const created = await client.menus.create({ name, slug });
        setMenuId(created.id);
        router.replace(`/menus/${created.id}`);
      }
    } catch {
      setSaveError(t('builder.saveError'));
    } finally {
      setSaving(false);
    }
  }, [session, menuId, name, slug, router, t]);

  return {
    menuId,
    saving,
    saveError,
    name,
    slug,
    setName,
    setSlug,
    handleSave: () => {
      void save();
    },
  };
}
