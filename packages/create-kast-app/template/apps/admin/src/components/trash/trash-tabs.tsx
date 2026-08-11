'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useApiClient, useSession } from '@/lib/session';
import type { TrashedItem, TrashModel } from '@kast-cms/sdk';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState, type JSX } from 'react';
import { TrashTable } from './trash-table';

const MODELS: TrashModel[] = ['content', 'media', 'user', 'form'];

type ItemMap = Record<TrashModel, TrashedItem[]>;
type LoadingMap = Record<TrashModel, boolean>;

const emptyItems = (): ItemMap => ({ content: [], media: [], user: [], form: [] });
const allLoading = (): LoadingMap => ({ content: true, media: true, user: true, form: true });

export function TrashTabs(): JSX.Element {
  const client = useApiClient();
  const t = useTranslations('trash');
  const { session } = useSession();
  const [items, setItems] = useState<ItemMap>(emptyItems);
  const [loading, setLoading] = useState<LoadingMap>(allLoading);
  const [actionId, setActionId] = useState<string | null>(null);

  const loadModel = useCallback(
    async (model: TrashModel): Promise<void> => {
      if (!session) return;
      setLoading((prev) => ({ ...prev, [model]: true }));
      try {
        const res = await client.trash.list({ model });
        setItems((prev) => ({ ...prev, [model]: res.items }));
      } finally {
        setLoading((prev) => ({ ...prev, [model]: false }));
      }
    },
    [session, client],
  );

  useEffect(() => {
    MODELS.forEach((m) => {
      void loadModel(m);
    });
  }, [loadModel]);

  const handleRestore = useCallback(
    (model: TrashModel) =>
      async (id: string): Promise<void> => {
        if (!session) return;
        setActionId(id);
        try {
          await client.trash.restore(model, id);
          await loadModel(model);
        } finally {
          setActionId(null);
        }
      },
    [session, loadModel, client],
  );

  const handleDelete = useCallback(
    (model: TrashModel) =>
      async (id: string): Promise<void> => {
        if (!session) return;
        if (!window.confirm(t('deleteConfirm'))) return;
        setActionId(id);
        try {
          await client.trash.permanentDelete(model, id);
          await loadModel(model);
        } finally {
          setActionId(null);
        }
      },
    [session, loadModel, t, client],
  );

  return (
    <Tabs defaultValue="content">
      <TabsList>
        {MODELS.map((m) => (
          <TabsTrigger key={m} value={m}>
            {t(`tabs.${m}`)}
          </TabsTrigger>
        ))}
      </TabsList>
      {MODELS.map((m) => (
        <TabsContent key={m} value={m}>
          <TrashTable
            model={m}
            items={items[m]}
            loading={loading[m]}
            actionId={actionId}
            onRestore={(id) => {
              void handleRestore(m)(id);
            }}
            onDelete={(id) => {
              void handleDelete(m)(id);
            }}
          />
        </TabsContent>
      ))}
    </Tabs>
  );
}
