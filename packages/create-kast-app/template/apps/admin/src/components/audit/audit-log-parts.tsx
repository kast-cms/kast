'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { AuditLogEntry, AuditLogMeta } from '@kast-cms/sdk';
import { Bot, ChevronLeft, ChevronRight, ScrollText, Search, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type ChangeEvent, type JSX } from 'react';

export interface FilterDraft {
  action: string;
  resource: string;
  userId: string;
  from: string;
  to: string;
}

/**
 * Destructive actions are the ones you scan a log for, so they get the loudest
 * treatment; creations read as positive, everything else stays neutral.
 */
type ActionTone = 'destructive' | 'success' | 'info' | 'muted';

function actionTone(action: string): ActionTone {
  const lower = action.toLowerCase();
  if (lower.includes('delete') || lower.includes('remove') || lower.includes('revoke')) {
    return 'destructive';
  }
  if (lower.includes('create')) return 'success';
  if (lower.includes('update') || lower.includes('publish')) return 'info';
  return 'muted';
}

export function ActionBadge({ action }: { action: string }): JSX.Element {
  return (
    <Badge variant={actionTone(action)} className="font-mono">
      {action}
    </Badge>
  );
}

interface FilterBarProps {
  draft: FilterDraft;
  onDraftChange: (d: FilterDraft) => void;
  onApply: () => void;
  onClear: () => void;
}

export function FilterBar({ draft, onDraftChange, onApply, onClear }: FilterBarProps): JSX.Element {
  const t = useTranslations('auditLog.filters');
  const set =
    (key: keyof FilterDraft) =>
    (e: ChangeEvent<HTMLInputElement>): void => {
      onDraftChange({ ...draft, [key]: e.target.value });
    };
  return (
    <Card className="p-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="space-y-1.5">
          <Label htmlFor="audit-action">{t('action')}</Label>
          <Input
            id="audit-action"
            startAdornment={<Search />}
            placeholder={t('actionPlaceholder')}
            value={draft.action}
            onChange={set('action')}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="audit-resource">{t('resource')}</Label>
          <Input
            id="audit-resource"
            startAdornment={<Search />}
            placeholder={t('resourcePlaceholder')}
            value={draft.resource}
            onChange={set('resource')}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="audit-user">{t('userId')}</Label>
          <Input
            id="audit-user"
            placeholder={t('userIdPlaceholder')}
            value={draft.userId}
            onChange={set('userId')}
            className="font-mono"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="audit-from">{t('from')}</Label>
          <Input id="audit-from" type="date" value={draft.from} onChange={set('from')} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="audit-to">{t('to')}</Label>
          <Input id="audit-to" type="date" value={draft.to} onChange={set('to')} />
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <Button size="sm" onClick={onApply}>
          <Search />
          {t('apply')}
        </Button>
        <Button size="sm" variant="ghost" onClick={onClear}>
          <X />
          {t('clear')}
        </Button>
      </div>
    </Card>
  );
}

interface AuditTableProps {
  entries: AuditLogEntry[];
  loading: boolean;
}

/** Placeholder rows that hold the log's shape between pages. */
function AuditTableSkeleton(): JSX.Element {
  return (
    <>
      {Array.from({ length: 8 }, (_, i) => (
        <TableRow key={i} className="hover:bg-transparent">
          <TableCell>
            <Skeleton className="h-4.5 w-28 rounded-md" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-3 w-20" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-3 w-24" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-3 w-20" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-3 w-24" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-3 w-32" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

export function AuditTable({ entries, loading }: AuditTableProps): JSX.Element {
  const t = useTranslations('auditLog');
  const isEmpty = entries.length === 0;

  return (
    <Card className="overflow-hidden" aria-busy={loading}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('table.action')}</TableHead>
            <TableHead>{t('table.resource')}</TableHead>
            <TableHead>{t('table.resourceId')}</TableHead>
            <TableHead>{t('table.actor')}</TableHead>
            <TableHead>{t('table.ip')}</TableHead>
            <TableHead className="text-end">{t('table.timestamp')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isEmpty && loading && <AuditTableSkeleton />}
          {isEmpty && !loading && (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={6} className="p-0">
                <EmptyState
                  Icon={ScrollText}
                  size="sm"
                  title={t('noEntries')}
                  description={t('subtitle')}
                  className="rounded-none border-0"
                />
              </TableCell>
            </TableRow>
          )}
          {entries.map((entry) => (
            <TableRow key={entry.id}>
              <TableCell className="py-2.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <ActionBadge action={entry.action} />
                  {entry.isDryRun && (
                    <Badge variant="outline" size="sm">
                      dry-run
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell className="py-2.5 font-mono text-xs text-foreground">
                {entry.resource}
              </TableCell>
              <TableCell className="py-2.5 font-mono text-xs text-muted-foreground">
                {entry.resourceId ?? '—'}
              </TableCell>
              <TableCell className="py-2.5 text-xs">
                {entry.agentName !== null ? (
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <Bot className="size-3.5 shrink-0 text-info" aria-hidden="true" />
                    {entry.agentName}
                  </span>
                ) : entry.userId !== null ? (
                  <span className="font-mono text-foreground">{entry.userId.slice(0, 8)}…</span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="py-2.5 font-mono text-xs text-muted-foreground">
                {entry.ipAddress ?? '—'}
              </TableCell>
              <TableCell className="py-2.5 text-end text-xs whitespace-nowrap text-muted-foreground">
                {new Date(entry.createdAt).toLocaleString()}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

interface PaginationBarProps {
  meta: AuditLogMeta;
  cursorStack: string[];
  onNext: () => void;
  onPrev: () => void;
}

export function PaginationBar({
  meta,
  cursorStack,
  onNext,
  onPrev,
}: PaginationBarProps): JSX.Element {
  const t = useTranslations('auditLog');
  return (
    <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
      <span className="tabular-nums">{t('total', { count: meta.total })}</span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={cursorStack.length === 0} onClick={onPrev}>
          <ChevronLeft className="rtl:rotate-180" />
          {t('prev')}
        </Button>
        <Button variant="outline" size="sm" disabled={!meta.hasNextPage} onClick={onNext}>
          {t('next')}
          <ChevronRight className="rtl:rotate-180" />
        </Button>
      </div>
    </div>
  );
}
