'use client';

import { Checkbox } from '@/components/ui/checkbox';
import type { MediaFileSummary } from '@kast-cms/sdk';
import { FileIcon, FileText, Video } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import type { JSX } from 'react';

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${String(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileTypeIcon({ mimeType }: { mimeType: string }): JSX.Element {
  if (mimeType.startsWith('video/'))
    return <Video className="h-10 w-10 text-[--color-muted-foreground]" />;
  if (mimeType.startsWith('image/'))
    return <FileIcon className="h-10 w-10 text-[--color-muted-foreground]" />;
  return <FileText className="h-10 w-10 text-[--color-muted-foreground]" />;
}

interface MediaCardProps {
  file: MediaFileSummary;
  selected: boolean;
  onToggle: (id: string) => void;
  onClick: (file: MediaFileSummary) => void;
}

function MediaCard({ file, selected, onToggle, onClick }: MediaCardProps): JSX.Element {
  const ringClass = selected ? 'ring-2 ring-[--color-primary]' : 'border border-[--color-border]';
  return (
    <div
      role="button"
      tabIndex={0}
      className={`group relative cursor-pointer overflow-hidden rounded-lg hover:ring-2 hover:ring-[--color-primary] ${ringClass}`}
      onClick={() => {
        onClick(file);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onClick(file);
      }}
    >
      <div className="absolute start-2 top-2 z-10 opacity-0 transition-opacity group-hover:opacity-100">
        <Checkbox
          checked={selected}
          onCheckedChange={() => {
            onToggle(file.id);
          }}
          onClick={(e) => {
            e.stopPropagation();
          }}
        />
      </div>
      <div className="relative flex aspect-square items-center justify-center bg-[--color-muted]">
        {file.mimeType.startsWith('image/') ? (
          <Image
            src={file.url}
            alt={file.altText ?? file.filename}
            fill
            unoptimized
            className="object-cover"
          />
        ) : (
          <FileTypeIcon mimeType={file.mimeType} />
        )}
      </div>
      <div className="p-2">
        <p className="truncate text-xs font-medium">{file.filename}</p>
        <p className="text-xs text-[--color-muted-foreground]">{formatBytes(file.size)}</p>
      </div>
    </div>
  );
}

interface MediaListRowProps {
  file: MediaFileSummary;
  selected: boolean;
  onToggle: (id: string) => void;
  onClick: (file: MediaFileSummary) => void;
}

function MediaListRow({ file, selected, onToggle, onClick }: MediaListRowProps): JSX.Element {
  return (
    <div
      role="button"
      tabIndex={0}
      className="flex cursor-pointer items-center gap-3 rounded-lg border border-[--color-border] p-2 hover:bg-[--color-muted]"
      onClick={() => {
        onClick(file);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onClick(file);
      }}
    >
      <Checkbox
        checked={selected}
        onCheckedChange={() => {
          onToggle(file.id);
        }}
        onClick={(e) => {
          e.stopPropagation();
        }}
      />
      <span className="flex-1 truncate text-sm">{file.filename}</span>
      <span className="text-xs text-[--color-muted-foreground]">{file.mimeType}</span>
      <span className="text-xs text-[--color-muted-foreground]">{formatBytes(file.size)}</span>
    </div>
  );
}

interface MediaGridProps {
  files: MediaFileSummary[];
  view: 'grid' | 'list';
  selected: Set<string>;
  onToggle: (id: string) => void;
  onFileClick: (file: MediaFileSummary) => void;
  loading: boolean;
}

export function MediaGrid({
  files,
  view,
  selected,
  onToggle,
  onFileClick,
  loading,
}: MediaGridProps): JSX.Element {
  const t = useTranslations('mediaLibrary');

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[--color-muted] border-t-[--color-primary]" />
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="flex h-48 flex-col items-center justify-center gap-2 text-[--color-muted-foreground]">
        <FileText className="h-12 w-12" />
        <p className="text-sm">{t('noFiles')}</p>
      </div>
    );
  }

  if (view === 'list') {
    return (
      <div className="flex flex-col gap-1">
        {files.map((f) => (
          <MediaListRow
            key={f.id}
            file={f}
            selected={selected.has(f.id)}
            onToggle={onToggle}
            onClick={onFileClick}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {files.map((f) => (
        <MediaCard
          key={f.id}
          file={f}
          selected={selected.has(f.id)}
          onToggle={onToggle}
          onClick={onFileClick}
        />
      ))}
    </div>
  );
}
