'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { createApiClient } from '@/lib/api';
import { useSession } from '@/lib/session';
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
        const client = createApiClient(session.accessToken);
        const res = await client.trash.list({ model });
        setItems((prev) => ({ ...prev, [model]: res.items }));
      } finally {
        setLoading((prev) => ({ ...prev, [model]: false }));
      }
    },
    [session],
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
          const client = createApiClient(session.accessToken);
          await client.trash.restore(model, id);
          await loadModel(model);
        } finally {
          setActionId(null);
        }
      },
    [session, loadModel],
  );

  const handleDelete = useCallback(
    (model: TrashModel) =>
      async (id: string): Promise<void> => {
        if (!session) return;
        if (!window.confirm(t('deleteConfirm'))) return;
        setActionId(id);
        try {
          const client = createApiClient(session.accessToken);
          await client.trash.permanentDelete(model, id);
          await loadModel(model);
        } finally {
          setActionId(null);
        }
      },
    [session, loadModel, t],
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
        <TabsContent key={m} value={m} className="mt-4">
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
