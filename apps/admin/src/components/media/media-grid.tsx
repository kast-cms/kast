'use client';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { MediaFileSummary } from '@kast-cms/sdk';
import { FileImage, FileText, ImageOff, Video } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import type { JSX } from 'react';

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${String(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Tiles are laid out on a fluid track so the grid reflows when the detail rail opens. */
const TILE_GRID = 'grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-4';

function FileTypeIcon({
  mimeType,
  className,
}: {
  mimeType: string;
  className?: string;
}): JSX.Element {
  if (mimeType.startsWith('video/')) return <Video className={className} />;
  if (mimeType.startsWith('image/')) return <FileImage className={className} />;
  return <FileText className={className} />;
}

/** The extension doubles as a type chip — cheaper to scan than a full MIME string. */
function fileExtension(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot > 0 ? filename.slice(dot + 1).toUpperCase() : '';
}

interface MediaCardProps {
  file: MediaFileSummary;
  selected: boolean;
  onToggle: (id: string) => void;
  onClick: (file: MediaFileSummary) => void;
}

function MediaCard({ file, selected, onToggle, onClick }: MediaCardProps): JSX.Element {
  const extension = fileExtension(file.filename);

  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        'group relative cursor-pointer overflow-hidden rounded-lg border bg-card text-start shadow-2xs',
        'transition-[border-color,box-shadow] duration-150 ease-out-quad',
        'hover:border-border-strong hover:shadow-md',
        'outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        selected
          ? 'border-primary ring-2 ring-primary ring-offset-2 ring-offset-background'
          : 'border-border',
      )}
      onClick={() => {
        onClick(file);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onClick(file);
      }}
    >
      <div className="relative flex aspect-square items-center justify-center overflow-hidden bg-muted">
        {file.mimeType.startsWith('image/') ? (
          <Image
            src={file.url}
            alt={file.altText ?? file.filename}
            fill
            unoptimized
            sizes="(min-width: 1280px) 12rem, (min-width: 640px) 25vw, 50vw"
            className="object-cover transition-transform duration-150 ease-out-quad group-hover:scale-[1.04]"
          />
        ) : (
          <FileTypeIcon mimeType={file.mimeType} className="size-9 text-muted-foreground" />
        )}

        {/* Hover scrim — enough to lift the controls off a busy photo, no more. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-foreground/0 transition-colors duration-150 ease-out-quad group-hover:bg-foreground/10"
        />

        <div
          className={cn(
            'absolute start-2 top-2 z-10 transition-opacity duration-150 ease-out-quad',
            selected
              ? 'opacity-100'
              : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100',
          )}
        >
          <Checkbox
            checked={selected}
            aria-label={file.filename}
            onCheckedChange={() => {
              onToggle(file.id);
            }}
            onClick={(e) => {
              e.stopPropagation();
            }}
          />
        </div>

        {extension !== '' && (
          <Badge
            variant="muted"
            size="sm"
            className="absolute end-2 top-2 bg-card/85 font-semibold tracking-wide backdrop-blur-sm"
          >
            {extension}
          </Badge>
        )}
      </div>

      <div className="space-y-0.5 border-t border-border px-2.5 py-2">
        <p className="truncate text-xs font-medium text-foreground">{file.filename}</p>
        <p className="text-2xs tabular-nums text-muted-foreground">{formatBytes(file.size)}</p>
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
      className={cn(
        'flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors duration-150 ease-out-quad',
        'outline-none focus-visible:bg-muted',
        selected ? 'bg-primary-subtle/60' : 'hover:bg-muted/60',
      )}
      onClick={() => {
        onClick(file);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onClick(file);
      }}
    >
      <Checkbox
        checked={selected}
        aria-label={file.filename}
        onCheckedChange={() => {
          onToggle(file.id);
        }}
        onClick={(e) => {
          e.stopPropagation();
        }}
      />
      <span className="grid size-8 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
        <FileTypeIcon mimeType={file.mimeType} className="size-4" />
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
        {file.filename}
      </span>
      <Badge variant="muted" size="sm" className="hidden max-w-40 overflow-hidden sm:inline-flex">
        <span className="truncate">{file.mimeType}</span>
      </Badge>
      <span className="w-16 shrink-0 text-end text-xs tabular-nums text-muted-foreground">
        {formatBytes(file.size)}
      </span>
    </div>
  );
}

function GridSkeleton(): JSX.Element {
  return (
    <div className={TILE_GRID}>
      {Array.from({ length: 12 }, (_, i) => (
        <div key={i} className="overflow-hidden rounded-lg border border-border bg-card shadow-2xs">
          <Skeleton className="aspect-square rounded-none" />
          <div className="space-y-1.5 border-t border-border px-2.5 py-2.5">
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-2.5 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ListSkeleton(): JSX.Element {
  return (
    <Card className="divide-y divide-border overflow-hidden">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-3">
          <Skeleton className="size-4 rounded-sm" />
          <Skeleton className="size-8 rounded-md" />
          <Skeleton className="h-3 w-full max-w-64" />
          <Skeleton className="ms-auto h-3 w-16" />
        </div>
      ))}
    </Card>
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
    return view === 'list' ? <ListSkeleton /> : <GridSkeleton />;
  }

  if (files.length === 0) {
    return <EmptyState Icon={ImageOff} title={t('noFiles')} />;
  }

  if (view === 'list') {
    return (
      <Card className="divide-y divide-border overflow-hidden">
        {files.map((f) => (
          <MediaListRow
            key={f.id}
            file={f}
            selected={selected.has(f.id)}
            onToggle={onToggle}
            onClick={onFileClick}
          />
        ))}
      </Card>
    );
  }

  return (
    <div className={TILE_GRID}>
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
