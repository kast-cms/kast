'use client';

import { Button } from '@/components/ui/button';
import { Hint } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronRight, GripVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { JSX } from 'react';

interface NodeConnectorProps {
  depth: number;
}

/**
 * Elbow connector back to the parent row. The vertical leg overshoots by the
 * 4px row gap so the guide reads as one continuous line. Top-level rows have no
 * parent to point at, so they draw nothing.
 */
export function NodeConnector({ depth }: NodeConnectorProps): JSX.Element | null {
  if (depth === 0) return null;

  return (
    <>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -start-3 -top-1 h-[calc(50%+0.25rem)] w-px bg-border"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 -start-3 h-px w-3 bg-border"
      />
    </>
  );
}

/** Drag affordance. Decorative until reordering is wired up, so it stays out of the a11y tree. */
export function NodeGrip(): JSX.Element {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid size-6 shrink-0 cursor-grab place-items-center rounded-md',
        'text-muted-foreground/50 transition-colors duration-150 ease-out-quad',
        'group-hover:text-muted-foreground active:cursor-grabbing',
      )}
    >
      <GripVertical className="size-3.5" />
    </span>
  );
}

/**
 * Expand/collapse control. Leaf rows render an equally sized spacer so labels
 * stay aligned down the column whether or not a row has children.
 */
export function NodeToggle({
  label,
  hasChildren,
  expanded,
  onToggle,
}: {
  label: string;
  hasChildren: boolean;
  expanded: boolean;
  onToggle: () => void;
}): JSX.Element {
  if (!hasChildren) return <span aria-hidden="true" className="size-5 shrink-0" />;

  return (
    <button
      type="button"
      aria-expanded={expanded}
      aria-label={label}
      className={cn(
        'grid size-5 shrink-0 place-items-center rounded-sm text-muted-foreground',
        'transition-colors duration-150 ease-out-quad hover:bg-muted hover:text-foreground',
        'outline-none focus-visible:ring-2 focus-visible:ring-ring/70',
      )}
      onClick={onToggle}
    >
      {expanded ? (
        <ChevronDown className="size-3.5" />
      ) : (
        <ChevronRight className="size-3.5 rtl:rotate-180" />
      )}
    </button>
  );
}

/** Row actions, revealed on hover or keyboard focus. */
export function NodeActions({
  canNest,
  onAddChild,
  onEdit,
  onDelete,
}: {
  canNest: boolean;
  onAddChild: () => void;
  onEdit: () => void;
  onDelete: () => void;
}): JSX.Element {
  const t = useTranslations('menus.builder.tree');
  return (
    <div className="flex shrink-0 items-center gap-0.5 opacity-70 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100">
      {canNest && (
        <Hint label={t('addItem')}>
          <Button size="icon-xs" variant="ghost" aria-label={t('addItem')} onClick={onAddChild}>
            <Plus />
          </Button>
        </Hint>
      )}
      <Hint label={t('edit')}>
        <Button size="icon-xs" variant="ghost" aria-label={t('edit')} onClick={onEdit}>
          <Pencil />
        </Button>
      </Hint>
      <Hint label={t('delete')}>
        <Button
          size="icon-xs"
          variant="ghost-destructive"
          aria-label={t('delete')}
          onClick={onDelete}
        >
          <Trash2 />
        </Button>
      </Hint>
    </div>
  );
}
