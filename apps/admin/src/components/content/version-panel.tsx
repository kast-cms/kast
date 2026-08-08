'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Sheet, SheetBody, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { createApiClient } from '@/lib/api';
import { useSession } from '@/lib/session';
import { cn } from '@/lib/utils';
import type { ContentEntryVersion } from '@kast-cms/sdk';
import { History } from 'lucide-react';
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

/** The body only ever shows one of three things, so name them once. */
type ListState = 'loading' | 'empty' | 'list';

function getListState(loading: boolean, count: number): ListState {
  if (loading) return 'loading';
  if (count === 0) return 'empty';
  return 'list';
}

/** Placeholder rows that hold the list's shape while versions load. */
function VersionSkeleton(): JSX.Element {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }, (_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-md" />
      ))}
    </div>
  );
}

interface VersionListProps {
  versions: ContentEntryVersion[];
  selected: ContentEntryVersion | null;
  onSelect: (version: ContentEntryVersion) => void;
}

function VersionList({ versions, selected, onSelect }: VersionListProps): JSX.Element {
  const t = useTranslations('content.versions');
  return (
    <ul className="space-y-1">
      {versions.map((v) => {
        const isSelected = selected?.id === v.id;
        const meta = [
          v.savedByName ? t('by', { name: v.savedByName }) : null,
          relativeTime(v.createdAt),
        ]
          .filter(Boolean)
          .join(' · ');
        return (
          <li key={v.id}>
            <button
              type="button"
              aria-pressed={isSelected}
              className={cn(
                'flex w-full flex-col gap-0.5 rounded-md border border-transparent px-3 py-2 text-start',
                'transition-colors duration-150 ease-out-quad',
                'outline-none focus-visible:ring-2 focus-visible:ring-ring/70',
                isSelected
                  ? 'border-primary/25 bg-primary-subtle text-primary-subtle-foreground'
                  : 'hover:bg-muted',
              )}
              onClick={() => {
                onSelect(v);
              }}
            >
              <span className="text-sm font-medium">
                {t('version', { number: v.versionNumber })}
              </span>
              <span
                className={cn(
                  'text-xs',
                  isSelected ? 'text-primary-subtle-foreground/75' : 'text-muted-foreground',
                )}
              >
                {meta}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

interface VersionDetailProps {
  version: ContentEntryVersion;
  confirming: boolean;
  isReverting: boolean;
  onStartConfirm: () => void;
  onCancelConfirm: () => void;
  onConfirm: () => void;
}

/** Payload preview for the picked version, plus its two-step revert. */
function VersionDetail({
  version,
  confirming,
  isReverting,
  onStartConfirm,
  onCancelConfirm,
  onConfirm,
}: VersionDetailProps): JSX.Element {
  const t = useTranslations('content.versions');
  return (
    <div className="space-y-3 border-t border-border pt-4">
      <pre className="max-h-56 overflow-auto rounded-md border border-border bg-muted p-3 text-xs text-muted-foreground">
        {JSON.stringify(version.data, null, 2)}
      </pre>
      {!confirming && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="w-full"
          onClick={onStartConfirm}
        >
          {t('revert')}
        </Button>
      )}
      {confirming && (
        <Alert variant="warning">
          <AlertTitle>{t('confirmTitle', { number: version.versionNumber })}</AlertTitle>
          <AlertDescription>
            <p>{t('confirmDescription')}</p>
            <div className="mt-3 flex gap-2">
              <Button type="button" size="sm" loading={isReverting} onClick={onConfirm}>
                {isReverting ? t('reverting') : t('confirm')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isReverting}
                onClick={onCancelConfirm}
              >
                {t('cancel')}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
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

  const listState = getListState(loading, versions.length);

  return (
    <Sheet
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <SheetContent side="right" className="w-full sm:max-w-md" aria-describedby={undefined}>
        <SheetHeader>
          <SheetTitle>{t('title')}</SheetTitle>
        </SheetHeader>
        <SheetBody className="space-y-4">
          {listState === 'loading' && <VersionSkeleton />}
          {listState === 'empty' && <EmptyState Icon={History} title={t('empty')} size="sm" />}
          {listState === 'list' && (
            <VersionList
              versions={versions}
              selected={selected}
              onSelect={(v) => {
                setSelected(v);
                setConfirming(false);
              }}
            />
          )}
          {selected && (
            <VersionDetail
              version={selected}
              confirming={confirming}
              isReverting={isReverting}
              onStartConfirm={() => {
                setConfirming(true);
              }}
              onCancelConfirm={() => {
                setConfirming(false);
              }}
              onConfirm={() => {
                void handleRevert();
              }}
            />
          )}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
