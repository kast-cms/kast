'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { MediaFileDetail } from '@kast/sdk';
import { Copy, Trash2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { useState, type JSX } from 'react';
import { formatBytes } from './media-grid';

interface FileDetailProps {
  file: MediaFileDetail;
  onUpdate: (id: string, altText: string) => void;
  onTrash: (id: string) => void;
  onClose: () => void;
}

function MetaDl({
  file,
  t,
}: {
  file: MediaFileDetail;
  t: ReturnType<typeof useTranslations>;
}): JSX.Element {
  return (
    <dl className="space-y-1 text-xs">
      <div className="flex justify-between">
        <dt className="text-[--color-muted-foreground]">{t('detail.size')}</dt>
        <dd>{formatBytes(file.size)}</dd>
      </div>
      <div className="flex justify-between">
        <dt className="text-[--color-muted-foreground]">{t('detail.type')}</dt>
        <dd className="truncate ps-2">{file.mimeType}</dd>
      </div>
      {file.width !== null && (
        <div className="flex justify-between">
          <dt className="text-[--color-muted-foreground]">{t('detail.dimensions')}</dt>
          <dd>
            {file.width}×{file.height}
          </dd>
        </div>
      )}
      <div className="flex justify-between">
        <dt className="text-[--color-muted-foreground]">{t('detail.uploaded')}</dt>
        <dd>{new Date(file.createdAt).toLocaleDateString()}</dd>
      </div>
    </dl>
  );
}

export function FileDetail({ file, onUpdate, onTrash, onClose }: FileDetailProps): JSX.Element {
  const t = useTranslations('mediaLibrary');
  const [altText, setAltText] = useState(file.altText ?? '');
  const [saving, setSaving] = useState(false);
  const inUse = file.usages.length > 0;

  function handleSave(): void {
    setSaving(true);
    void Promise.resolve(onUpdate(file.id, altText)).finally(() => {
      setSaving(false);
    });
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-[--color-border] p-3">
        <span className="truncate text-sm font-medium">{file.filename}</span>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="relative aspect-video border-b border-[--color-border] bg-[--color-muted]">
        {file.mimeType.startsWith('image/') ? (
          <Image
            src={file.url}
            alt={file.altText ?? file.filename}
            fill
            unoptimized
            className="object-contain p-2"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-[--color-muted-foreground]">
            {file.mimeType}
          </div>
        )}
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-3">
        <div className="space-y-1">
          <Label className="text-xs">{t('detail.altText')}</Label>
          <Input
            value={altText}
            onChange={(e) => {
              setAltText(e.target.value);
            }}
            placeholder={t('detail.altTextPlaceholder')}
          />
          <Button size="sm" className="w-full" onClick={handleSave} disabled={saving}>
            {saving ? t('detail.saving') : t('detail.save')}
          </Button>
        </div>

        <MetaDl file={file} t={t} />

        <div className="space-y-1">
          <Label className="text-xs">{t('detail.url')}</Label>
          <div className="flex gap-1">
            <Input value={file.url} readOnly className="text-xs" />
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={() => {
                void navigator.clipboard.writeText(file.url);
              }}
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {inUse && (
          <div className="space-y-1">
            <p className="text-xs font-medium">
              {t('detail.usedIn', { count: file.usages.length })}
            </p>
            <ul className="space-y-1">
              {file.usages.map((u) => (
                <li key={u.entryId} className="text-xs text-[--color-muted-foreground]">
                  {u.entryTitle ?? u.entryId} — {u.fieldName}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="border-t border-[--color-border] p-3">
        <Button
          variant="destructive"
          size="sm"
          className="w-full"
          disabled={inUse}
          onClick={() => {
            onTrash(file.id);
          }}
        >
          <Trash2 className="me-2 h-4 w-4" />
          {inUse ? t('detail.trashDisabled') : t('detail.trash')}
        </Button>
      </div>
    </div>
  );
}
