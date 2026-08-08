'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { CreateMenuItemBody, MenuItemSummary, UpdateMenuItemBody } from '@kast-cms/sdk';
import { Link2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, type JSX } from 'react';
import { NodeActions, NodeConnector, NodeGrip, NodeToggle } from './menu-tree-parts';

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
    // Tinted with the brand so an open composer is obviously the live surface,
    // not just another row in the tree.
    <div className="space-y-4 rounded-lg border border-primary/25 bg-primary-subtle/40 p-4 shadow-xs">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
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
        <div className="space-y-1.5">
          <Label htmlFor="item-type">{t('linkType')}</Label>
          <Select
            value={linkType}
            onValueChange={(value) => {
              setLinkType(value as LinkType);
            }}
          >
            <SelectTrigger id="item-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LINK_TYPES.map((lt) => (
                <SelectItem key={lt} value={lt}>
                  {t(`types.${lt}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="item-url">{t('url')}</Label>
        <Input
          id="item-url"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
          }}
          placeholder={t('urlPlaceholder')}
          startAdornment={<Link2 />}
          className="font-mono text-xs"
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onCancel}>
          {t('cancel')}
        </Button>
        <Button size="sm" disabled={!label} loading={saving} onClick={handleSubmit}>
          {saving ? t('saving') : t('save')}
        </Button>
      </div>
    </div>
  );
}

// ── Recursive tree node ────────────────────────────────────

/**
 * Nested rows sit back a step so the hierarchy reads by weight as well as by
 * indent.
 */
function rowSurfaceClass(depth: number): string {
  return depth === 0 ? 'border-border bg-card' : 'border-border bg-muted/50';
}

/** A link target worth showing in the row: present and not blank. */
function hasVisibleUrl(item: MenuItemSummary): boolean {
  return item.url !== null && item.url !== '';
}

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
        className={cn(
          'group relative flex items-center gap-2 rounded-lg border px-2.5 py-2 text-sm shadow-2xs',
          'transition-[border-color,background-color,box-shadow] duration-150 ease-out-quad',
          'hover:border-border-strong hover:bg-accent/40',
          'focus-within:border-ring/50 focus-within:shadow-sm',
          rowSurfaceClass(depth),
        )}
        style={{ marginInlineStart: depth * 24 }}
      >
        <NodeConnector depth={depth} />

        <NodeGrip />

        <NodeToggle
          label={item.label}
          hasChildren={hasChildren}
          expanded={expanded}
          onToggle={() => {
            setExpanded((v) => !v);
          }}
        />

        <span className="min-w-0 flex-1 truncate font-medium text-foreground">{item.label}</span>

        {hasChildren && (
          <Badge variant="muted" size="sm" className="shrink-0">
            {item.children.length}
          </Badge>
        )}

        {hasVisibleUrl(item) && (
          <span className="hidden max-w-48 shrink-0 truncate font-mono text-xs text-muted-foreground sm:inline">
            {item.url}
          </span>
        )}

        <NodeActions
          canNest={canNest}
          onAddChild={() => {
            onAddChild(item.id);
          }}
          onEdit={() => {
            onEdit(item);
          }}
          onDelete={() => {
            onDelete(item.id);
          }}
        />
      </div>

      {expanded && hasChildren && (
        <div className="mt-1 flex flex-col gap-1">
          {item.children.map((child) => (
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
      )}
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
        className={cn(
          'rounded-sm text-start font-medium text-foreground underline-offset-4',
          'transition-colors duration-150 ease-out-quad hover:text-primary hover:underline',
          'outline-none focus-visible:ring-2 focus-visible:ring-ring/70',
        )}
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
