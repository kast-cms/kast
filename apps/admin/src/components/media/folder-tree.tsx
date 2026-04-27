'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { MediaFolder } from '@kast-cms/sdk';
import { ChevronDown, ChevronRight, Folder, FolderOpen, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, type JSX } from 'react';

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
        className={`flex w-full items-center gap-1 rounded px-2 py-1 text-sm hover:bg-[--color-muted] ${isSelected ? 'bg-[--color-muted] font-medium' : ''}`}
        onClick={() => {
          onSelect(isSelected ? null : folder.id);
        }}
      >
        <span
          className="flex w-4 shrink-0 items-center justify-center"
          onClick={(e) => {
            e.stopPropagation();
            setOpen(!open);
          }}
        >
          {hasChildren ? (
            open ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )
          ) : null}
        </span>
        {open ? (
          <FolderOpen className="h-4 w-4 shrink-0" />
        ) : (
          <Folder className="h-4 w-4 shrink-0" />
        )}
        <span className="truncate">{folder.name}</span>
        <span className="ms-auto text-xs text-[--color-muted-foreground]">{folder.filesCount}</span>
      </button>
      {open && folder.children.length > 0 && (
        <div className="ps-4">
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
    <div className="flex flex-col gap-1">
      <button
        type="button"
        className={`flex w-full items-center gap-2 rounded px-2 py-1 text-sm hover:bg-[--color-muted] ${selectedId === null ? 'bg-[--color-muted] font-medium' : ''}`}
        onClick={() => {
          onSelect(null);
        }}
      >
        <Folder className="h-4 w-4 shrink-0" />
        <span>{t('folder.allFiles')}</span>
      </button>

      {folders.map((f) => (
        <FolderNode key={f.id} folder={f} selectedId={selectedId} onSelect={onSelect} />
      ))}

      {creating ? (
        <div className="flex gap-1 px-2 pt-2">
          <Input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
            }}
            placeholder={t('folder.namePlaceholder')}
            className="h-7 text-sm"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate();
            }}
            autoFocus
          />
          <Button size="sm" className="h-7" onClick={handleCreate}>
            {t('folder.create')}
          </Button>
        </div>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 justify-start gap-1"
          onClick={() => {
            setCreating(true);
          }}
        >
          <Plus className="h-4 w-4" />
          {t('folder.new')}
        </Button>
      )}
    </div>
  );
}
