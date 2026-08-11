'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { MediaFolder } from '@kast-cms/sdk';
import { ChevronDown, ChevronRight, Folder, FolderOpen, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, type JSX } from 'react';

/** One row treatment shared by "All files" and every folder node. */
const ROW_BASE = [
  'flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-sm',
  'transition-colors duration-150 ease-out-quad',
  'outline-none focus-visible:ring-2 focus-visible:ring-ring/70',
].join(' ');
const ROW_SELECTED = 'bg-primary-subtle font-medium text-primary-subtle-foreground';
const ROW_IDLE = 'text-foreground hover:bg-muted';

interface FolderNodeProps {
  folder: MediaFolder;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

function FolderNode({ folder, selectedId, onSelect }: FolderNodeProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const isSelected = selectedId === folder.id;
  const hasChildren = folder.children.length > 0;

  return (
    <div>
      <button
        type="button"
        className={cn(ROW_BASE, isSelected ? ROW_SELECTED : ROW_IDLE)}
        onClick={() => {
          onSelect(isSelected ? null : folder.id);
        }}
      >
        <span
          className="flex size-4 shrink-0 items-center justify-center text-muted-foreground"
          onClick={(e) => {
            e.stopPropagation();
            setOpen(!open);
          }}
        >
          {hasChildren ? (
            open ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronRight className="size-3.5 rtl:rotate-180" />
            )
          ) : null}
        </span>
        {open ? (
          <FolderOpen
            className={cn('size-4 shrink-0', isSelected ? 'text-primary' : 'text-muted-foreground')}
          />
        ) : (
          <Folder
            className={cn('size-4 shrink-0', isSelected ? 'text-primary' : 'text-muted-foreground')}
          />
        )}
        <span className="truncate">{folder.name}</span>
        <span
          className={cn(
            'ms-auto shrink-0 ps-1 text-2xs tabular-nums',
            isSelected ? 'text-primary-subtle-foreground/80' : 'text-muted-foreground',
          )}
        >
          {folder.filesCount}
        </span>
      </button>
      {open && folder.children.length > 0 && (
        // The guide line makes depth readable without extra indentation.
        <div className="ms-4 space-y-0.5 border-s border-border ps-2">
          {folder.children.map((child) => (
            <FolderNode key={child.id} folder={child} selectedId={selectedId} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  );
}

interface FolderTreeProps {
  folders: MediaFolder[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onCreate: (name: string, parentId?: string) => void;
}

export function FolderTree({
  folders,
  selectedId,
  onSelect,
  onCreate,
}: FolderTreeProps): JSX.Element {
  const t = useTranslations('mediaLibrary');
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');

  function handleCreate(): void {
    if (!name.trim()) return;
    onCreate(name.trim());
    setCreating(false);
    setName('');
  }

  return (
    <div className="flex flex-col gap-0.5">
      <button
        type="button"
        className={cn(ROW_BASE, selectedId === null ? ROW_SELECTED : ROW_IDLE)}
        onClick={() => {
          onSelect(null);
        }}
      >
        <span aria-hidden="true" className="size-4 shrink-0" />
        <Folder
          className={cn(
            'size-4 shrink-0',
            selectedId === null ? 'text-primary' : 'text-muted-foreground',
          )}
        />
        <span className="truncate">{t('folder.allFiles')}</span>
      </button>

      {folders.map((f) => (
        <FolderNode key={f.id} folder={f} selectedId={selectedId} onSelect={onSelect} />
      ))}

      <Separator className="my-1.5" />

      {creating ? (
        <div className="space-y-1.5">
          <Input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
            }}
            placeholder={t('folder.namePlaceholder')}
            className="h-8 text-xs"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate();
            }}
            autoFocus
          />
          <Button size="sm" className="w-full" onClick={handleCreate}>
            {t('folder.create')}
          </Button>
        </div>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-1.5 text-muted-foreground hover:text-foreground"
          onClick={() => {
            setCreating(true);
          }}
        >
          <Plus />
          {t('folder.new')}
        </Button>
      )}
    </div>
  );
}
