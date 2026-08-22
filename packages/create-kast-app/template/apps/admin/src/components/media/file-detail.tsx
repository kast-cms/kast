'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { MediaFileDetail } from '@kast-cms/sdk';
import { Copy, FileText, Trash2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { useState, type JSX, type ReactNode } from 'react';
import { formatBytes } from './media-grid';

interface FileDetailProps {
  file: MediaFileDetail;
  onUpdate: (id: string, data: { altText: string; focalPoint?: { x: number; y: number } }) => void;
  onTrash: (id: string) => void;
  onClose: () => void;
}

function MetaRow({ label, children }: { label: string; children: ReactNode }): JSX.Element {
  return (
    <div className="flex items-baseline justify-between gap-3 px-3 py-2">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate text-end font-medium tabular-nums text-foreground">
        {children}
      </dd>
    </div>
  );
}

function MetaDl({
  file,
  t,
}: {
  file: MediaFileDetail;
  t: ReturnType<typeof useTranslations>;
}): JSX.Element {
  return (
    <dl className="divide-y divide-border overflow-hidden rounded-md border border-border text-xs">
      <MetaRow label={t('detail.size')}>{formatBytes(file.size)}</MetaRow>
      <MetaRow label={t('detail.type')}>{file.mimeType}</MetaRow>
      {file.width !== null && (
        <MetaRow label={t('detail.dimensions')}>
          {file.width}×{file.height}
        </MetaRow>
      )}
      <MetaRow label={t('detail.uploaded')}>
        {new Date(file.createdAt).toLocaleDateString()}
      </MetaRow>
    </dl>
  );
}

export function FileDetail({ file, onUpdate, onTrash, onClose }: FileDetailProps): JSX.Element {
  const t = useTranslations('mediaLibrary');
  const [altText, setAltText] = useState(file.altText ?? '');
  const [focalX, setFocalX] = useState(String(file.focalPoint?.x ?? 0.5));
  const [focalY, setFocalY] = useState(String(file.focalPoint?.y ?? 0.5));
  const [saving, setSaving] = useState(false);
  const usages = file.usages;
  const inUse = usages.length > 0;
  const variantEntries = Object.entries(file.variants);

  function handleSave(): void {
    setSaving(true);
    void Promise.resolve(
      onUpdate(file.id, {
        altText,
        focalPoint: { x: Number(focalX), y: Number(focalY) },
      }),
    ).finally(() => {
      setSaving(false);
    });
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="items-center gap-x-2 border-b border-border px-4 py-3">
        <CardTitle className="min-w-0 truncate text-sm">{file.filename}</CardTitle>
        <CardAction>
          <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose}>
            <X />
          </Button>
        </CardAction>
      </CardHeader>

      <div className="relative aspect-video border-b border-border bg-muted">
        {file.mimeType.startsWith('image/') ? (
          <Image
            src={file.url}
            alt={file.altText ?? file.filename}
            fill
            unoptimized
            sizes="20rem"
            className="object-contain p-3"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <FileText className="size-8" />
            <span className="max-w-full truncate px-3 text-xs">{file.mimeType}</span>
          </div>
        )}
      </div>

      <CardContent className="space-y-5 px-4 py-4">
        <div className="space-y-2">
          <Label htmlFor="media-alt-text" className="text-xs">
            {t('detail.altText')}
          </Label>
          <Input
            id="media-alt-text"
            value={altText}
            onChange={(e) => {
              setAltText(e.target.value);
            }}
            placeholder={t('detail.altTextPlaceholder')}
          />
          <Button size="sm" className="w-full" onClick={handleSave} loading={saving}>
            {saving ? t('detail.saving') : t('detail.save')}
          </Button>
        </div>

        {file.mimeType.startsWith('image/') && (
          <div className="space-y-2">
            <Label className="text-xs">{t('detail.focalPoint')}</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number"
                min="0"
                max="1"
                step="0.01"
                value={focalX}
                onChange={(e) => {
                  setFocalX(e.target.value);
                }}
                aria-label="Focal point X"
              />
              <Input
                type="number"
                min="0"
                max="1"
                step="0.01"
                value={focalY}
                onChange={(e) => {
                  setFocalY(e.target.value);
                }}
                aria-label="Focal point Y"
              />
            </div>
            <p className="text-2xs text-muted-foreground">{t('detail.focalPointHint')}</p>
          </div>
        )}

        <MetaDl file={file} t={t} />

        {variantEntries.length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs">{t('detail.variants')}</Label>
            <div className="divide-y divide-border overflow-hidden rounded-md border border-border text-xs">
              {variantEntries.map(([name, variant]) => (
                <div key={name} className="flex items-center gap-2 px-3 py-2">
                  <span className="font-medium text-foreground">{name}</span>
                  <span className="text-muted-foreground">
                    {variant.width}×{variant.height}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="ms-auto"
                    aria-label={`${t('detail.url')} ${name}`}
                    onClick={() => {
                      void navigator.clipboard.writeText(variant.url);
                    }}
                  >
                    <Copy />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="media-url" className="text-xs">
            {t('detail.url')}
          </Label>
          <div className="flex items-center gap-2">
            <Input id="media-url" value={file.url} readOnly className="font-mono text-xs" />
            <Button
              variant="outline"
              size="icon"
              className="shrink-0"
              aria-label={t('detail.url')}
              onClick={() => {
                void navigator.clipboard.writeText(file.url);
              }}
            >
              <Copy />
            </Button>
          </div>
        </div>

        {/* Usage is the reason the trash action is locked, so it is stated as a
            status message rather than a bare list. */}
        {inUse && (
          <Alert variant="info">
            <AlertTitle>{t('detail.usedIn', { count: usages.length })}</AlertTitle>
            <AlertDescription>
              <ul className="space-y-1">
                {usages.map((u) => (
                  <li key={u.entryId} className="truncate">
                    {u.entryTitle ?? u.entryId} — {u.fieldName}
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>

      <CardFooter className="px-4 py-3">
        <Button
          variant="destructive"
          size="sm"
          className="w-full"
          disabled={inUse}
          onClick={() => {
            onTrash(file.id);
          }}
        >
          <Trash2 />
          {inUse ? t('detail.trashDisabled') : t('detail.trash')}
        </Button>
      </CardFooter>
    </Card>
  );
}
