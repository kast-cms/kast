'use client';

import { Button } from '@/components/ui/button';
import { createApiClient } from '@/lib/api';
import { useSession } from '@/lib/session';
import type { ContentEntryVersion } from '@kast/sdk';
import { useTranslations } from 'next-intl';
import { useEffect, useState, type JSX } from 'react';

interface VersionPanelProps {
  typeId: string;
  entryId: string | null;
  open: boolean;
  onClose: () => void;
  onRevert: (versionId: string) => Promise<void>;
  isReverting: boolean;
}

function relativeTime(iso: string): string {
  const diff = (Date.parse(iso) - Date.now()) / 1000;
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  if (abs < 60) return rtf.format(Math.round(diff), 'second');
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  return rtf.format(Math.round(diff / 86400), 'day');
}

export function VersionPanel({
  typeId,
  entryId,
  open,
  onClose,
  onRevert,
  isReverting,
}: VersionPanelProps): JSX.Element | null {
  const { session } = useSession();
  const t = useTranslations('content.versions');
  const [versions, setVersions] = useState<ContentEntryVersion[]>([]);
  const [selected, setSelected] = useState<ContentEntryVersion | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const token = session?.accessToken;

  useEffect(() => {
    if (!open || !entryId) return;
    const c = createApiClient(token);
    setLoading(true);
    void c.content.listVersions(typeId, entryId).then((res) => {
      setVersions(res.data);
      setLoading(false);
    });
  }, [open, typeId, entryId, token]);

  if (!open || !entryId) return null;

  const handleRevert = async (): Promise<void> => {
    if (!selected) return;
    await onRevert(selected.id);
    setConfirming(false);
    onClose();
  };

  const renderList = (): JSX.Element => (
    <ul className="space-y-1">
      {versions.map((v) => (
        <li key={v.id}>
          <button
            type="button"
            className={`w-full rounded px-3 py-2 text-start text-sm hover:bg-[--color-muted] ${selected?.id === v.id ? 'bg-[--color-muted] font-medium' : ''}`}
            onClick={() => {
              setSelected(v);
              setConfirming(false);
            }}
          >
            {t('version', { number: v.versionNumber })}
            {v.savedByName && (
              <span className="ms-1 text-[--color-muted-foreground]">
                {t('by', { name: v.savedByName })}
              </span>
            )}
            <span className="ms-2 text-xs text-[--color-muted-foreground]">
              {relativeTime(v.createdAt)}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );

  const renderSelected = (v: ContentEntryVersion): JSX.Element => (
    <div className="space-y-3">
      <pre className="max-h-48 overflow-auto rounded bg-[--color-muted] p-3 text-xs">
        {JSON.stringify(v.data, null, 2)}
      </pre>
      {!confirming && (
        <Button
          type="button"
          size="sm"
          onClick={() => {
            setConfirming(true);
          }}
        >
          {t('revert')}
        </Button>
      )}
      {confirming && (
        <div className="space-y-2 rounded border border-[--color-border] p-3">
          <p className="text-sm font-medium">{t('confirmTitle', { number: v.versionNumber })}</p>
          <p className="text-xs text-[--color-muted-foreground]">{t('confirmDescription')}</p>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              disabled={isReverting}
              onClick={() => {
                void handleRevert();
              }}
            >
              {isReverting ? t('reverting') : t('confirm')}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isReverting}
              onClick={() => {
                setConfirming(false);
              }}
            >
              {t('cancel')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-y-0 end-0 z-50 flex w-80 flex-col border-s border-[--color-border] bg-[--color-background] shadow-lg">
      <div className="flex items-center justify-between border-b border-[--color-border] p-4">
        <h2 className="text-sm font-semibold">{t('title')}</h2>
        <button
          type="button"
          className="text-[--color-muted-foreground] hover:text-[--color-foreground]"
          onClick={onClose}
          aria-label="Close"
        >
          ✕
        </button>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {loading && <p className="text-sm text-[--color-muted-foreground]">…</p>}
        {!loading && versions.length === 0 && (
          <p className="text-sm text-[--color-muted-foreground]">{t('empty')}</p>
        )}
        {!loading && versions.length > 0 && renderList()}
        {selected && renderSelected(selected)}
      </div>
    </div>
  );
}
