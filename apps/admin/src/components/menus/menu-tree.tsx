'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { CreateMenuItemBody, MenuItemSummary, UpdateMenuItemBody } from '@kast/sdk';
import { ChevronDown, ChevronRight, GripVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, type JSX } from 'react';

// ── Link type options ──────────────────────────────────────

export const LINK_TYPES = ['external_url', 'anchor', 'content_entry', 'custom'] as const;
export type LinkType = (typeof LINK_TYPES)[number];

// ── Item form used by both add + edit ──────────────────────

interface ItemFormProps {
  initial?: Partial<CreateMenuItemBody>;
  onSave: (body: CreateMenuItemBody) => void;
  onCancel: () => void;
  saving: boolean;
}

export function MenuItemForm({ initial, onSave, onCancel, saving }: ItemFormProps): JSX.Element {
  const t = useTranslations('menus.itemForm');
  const [label, setLabel] = useState(initial?.label ?? '');
  const [linkType, setLinkType] = useState<LinkType>(
    (initial?.linkType ?? 'external_url') as LinkType,
  );
  const [url, setUrl] = useState(initial?.url ?? '');

  function handleSubmit(): void {
    onSave({ label, linkType, ...(url ? { url } : {}) });
  }

  return (
    <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
      <div className="space-y-1">
        <Label htmlFor="item-label">{t('label')}</Label>
        <Input
          id="item-label"
          value={label}
          onChange={(e) => {
            setLabel(e.target.value);
          }}
          placeholder={t('labelPlaceholder')}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="item-type">{t('linkType')}</Label>
        <select
          id="item-type"
          value={linkType}
          onChange={(e) => {
            setLinkType(e.target.value as LinkType);
          }}
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          {LINK_TYPES.map((lt) => (
            <option key={lt} value={lt}>
              {t(`types.${lt}`)}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="item-url">{t('url')}</Label>
        <Input
          id="item-url"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
          }}
          placeholder={t('urlPlaceholder')}
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={onCancel}>
          {t('cancel')}
        </Button>
        <Button size="sm" disabled={saving || !label} onClick={handleSubmit}>
          {saving ? t('saving') : t('save')}
        </Button>
      </div>
    </div>
  );
}

// ── Recursive tree node ────────────────────────────────────

interface TreeNodeProps {
  item: MenuItemSummary;
  depth: number;
  onAddChild: (parentId: string) => void;
  onEdit: (item: MenuItemSummary) => void;
  onDelete: (id: string) => void;
}

export function MenuTreeNode({
  item,
  depth,
  onAddChild,
  onEdit,
  onDelete,
}: TreeNodeProps): JSX.Element {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = item.children.length > 0;
  const canNest = depth < 2;

  return (
    <div className="select-none">
      <div
        className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm"
        style={{ marginLeft: `${depth * 20}px` }}
      >
        <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
        {hasChildren ? (
          <button
            type="button"
            className="shrink-0"
            onClick={() => {
              setExpanded((v) => !v);
            }}
          >
            {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        ) : (
          <span className="w-3 shrink-0" />
        )}
        <span className="min-w-0 flex-1 truncate font-medium">{item.label}</span>
        <span className="shrink-0 text-xs text-muted-foreground">{item.url ?? ''}</span>
        <div className="flex shrink-0 gap-1">
          {canNest && (
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={() => {
                onAddChild(item.id);
              }}
            >
              <Plus className="h-3 w-3" />
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={() => {
              onEdit(item);
            }}
          >
            <Pencil className="h-3 w-3" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 text-destructive"
            onClick={() => {
              onDelete(item.id);
            }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
      {expanded &&
        item.children.map((child) => (
          <MenuTreeNode
            key={child.id}
            item={child}
            depth={depth + 1}
            onAddChild={onAddChild}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
    </div>
  );
}

// ── Inline label edit ──────────────────────────────────────

interface InlineLabelProps {
  item: MenuItemSummary;
  onSave: (id: string, patch: UpdateMenuItemBody) => void;
}

export function InlineLabelEdit({ item, onSave }: InlineLabelProps): JSX.Element {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(item.label);

  if (!editing) {
    return (
      <button
        type="button"
        className="text-left underline-offset-2 hover:underline"
        onClick={() => {
          setEditing(true);
        }}
      >
        {item.label}
      </button>
    );
  }

  return (
    <Input
      autoFocus
      value={label}
      onChange={(e) => {
        setLabel(e.target.value);
      }}
      onBlur={() => {
        onSave(item.id, { label });
        setEditing(false);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          onSave(item.id, { label });
          setEditing(false);
        }
        if (e.key === 'Escape') {
          setLabel(item.label);
          setEditing(false);
        }
      }}
      className="h-7 w-48 text-sm"
    />
  );
}
