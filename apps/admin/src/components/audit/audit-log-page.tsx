'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { AuditLogEntry, AuditLogMeta } from '@kast/sdk';
import { Download, Search, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, type JSX } from 'react';
import { useAuditLog } from './use-audit-log';

interface FilterDraft {
  action: string;
  resource: string;
  userId: string;
  from: string;
  to: string;
}

function ActionBadge({ action }: { action: string }): JSX.Element {
  const lower = action.toLowerCase();
  const isDelete = lower.includes('delete') || lower.includes('remove');
  const isCreate = lower.includes('create');
  const variant = isDelete ? 'outline' : isCreate ? 'default' : 'secondary';
  const cls = isDelete ? 'border-destructive text-destructive' : '';
  return (
    <Badge variant={variant} className={cls}>
      {action}
    </Badge>
  );
}

function exportCsv(entries: AuditLogEntry[]): void {
  const headers = [
    'ID',
    'Action',
    'Resource',
    'ResourceId',
    'UserId',
    'AgentName',
    'IP',
    'DryRun',
    'CreatedAt',
  ];
  const rows = entries.map((e) => [
    e.id,
    e.action,
    e.resource,
    e.resourceId ?? '',
    e.userId ?? '',
    e.agentName ?? '',
    e.ipAddress ?? '',
    e.isDryRun ? 'true' : 'false',
    e.createdAt,
  ]);
  const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

interface FilterBarProps {
  draft: FilterDraft;
  onDraftChange: (d: FilterDraft) => void;
  onApply: () => void;
  onClear: () => void;
}

function FilterBar({ draft, onDraftChange, onApply, onClear }: FilterBarProps): JSX.Element {
  const t = useTranslations('auditLog.filters');
  const set =
    (key: keyof FilterDraft) =>
    (e: React.ChangeEvent<HTMLInputElement>): void => {
      onDraftChange({ ...draft, [key]: e.target.value });
    };
  return (
    <div className="rounded-lg border border-[--color-border] bg-[--color-card] p-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="space-y-1">
          <Label>{t('action')}</Label>
          <Input
            placeholder={t('actionPlaceholder')}
            value={draft.action}
            onChange={set('action')}
          />
        </div>
        <div className="space-y-1">
          <Label>{t('resource')}</Label>
          <Input
            placeholder={t('resourcePlaceholder')}
            value={draft.resource}
            onChange={set('resource')}
          />
        </div>
        <div className="space-y-1">
          <Label>{t('userId')}</Label>
          <Input
            placeholder={t('userIdPlaceholder')}
            value={draft.userId}
            onChange={set('userId')}
          />
        </div>
        <div className="space-y-1">
          <Label>{t('from')}</Label>
          <Input type="date" value={draft.from} onChange={set('from')} />
        </div>
        <div className="space-y-1">
          <Label>{t('to')}</Label>
          <Input type="date" value={draft.to} onChange={set('to')} />
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <Button size="sm" onClick={onApply}>
          <Search className="me-2 h-3.5 w-3.5" />
          {t('apply')}
        </Button>
        <Button size="sm" variant="ghost" onClick={onClear}>
          <X className="me-2 h-3.5 w-3.5" />
          {t('clear')}
        </Button>
      </div>
    </div>
  );
}

interface AuditTableProps {
  entries: AuditLogEntry[];
  loading: boolean;
}

function AuditTable({ entries, loading }: AuditTableProps): JSX.Element {
  const t = useTranslations('auditLog');
  return (
    <div className="rounded-lg border border-[--color-border]">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('table.action')}</TableHead>
            <TableHead>{t('table.resource')}</TableHead>
            <TableHead>{t('table.resourceId')}</TableHead>
            <TableHead>{t('table.actor')}</TableHead>
            <TableHead>{t('table.ip')}</TableHead>
            <TableHead>{t('table.timestamp')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="py-10 text-center text-[--color-muted-foreground]">
                {loading ? t('loading') : t('noEntries')}
              </TableCell>
            </TableRow>
          )}
          {entries.map((entry) => (
            <TableRow key={entry.id}>
              <TableCell>
                <ActionBadge action={entry.action} />
                {entry.isDryRun && (
                  <Badge variant="outline" className="ms-1 text-xs">
                    dry-run
                  </Badge>
                )}
              </TableCell>
              <TableCell className="font-mono text-xs">{entry.resource}</TableCell>
              <TableCell className="font-mono text-xs text-[--color-muted-foreground]">
                {entry.resourceId ?? '—'}
              </TableCell>
              <TableCell className="text-xs">
                {entry.agentName !== null ? (
                  <span className="text-[--color-muted-foreground]">🤖 {entry.agentName}</span>
                ) : entry.userId !== null ? (
                  <span className="font-mono">{entry.userId.slice(0, 8)}…</span>
                ) : (
                  '—'
                )}
              </TableCell>
              <TableCell className="font-mono text-xs text-[--color-muted-foreground]">
                {entry.ipAddress ?? '—'}
              </TableCell>
              <TableCell className="text-xs text-[--color-muted-foreground]">
                {new Date(entry.createdAt).toLocaleString()}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

interface PaginationBarProps {
  meta: AuditLogMeta;
  cursorStack: string[];
  onNext: () => void;
  onPrev: () => void;
}

function PaginationBar({ meta, cursorStack, onNext, onPrev }: PaginationBarProps): JSX.Element {
  const t = useTranslations('auditLog');
  return (
    <div className="flex items-center justify-between text-sm text-[--color-muted-foreground]">
      <span>{t('total', { count: meta.total })}</span>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={cursorStack.length === 0}
          onClick={onPrev}
          className="bg-white text-gray-700 border-gray-300 hover:bg-gray-100 hover:text-gray-900"
        >
          {t('prev')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!meta.hasNextPage}
          onClick={onNext}
          className="bg-white text-gray-700 border-gray-300 hover:bg-gray-100 hover:text-gray-900"
        >
          {t('next')}
        </Button>
      </div>
    </div>
  );
}

const EMPTY_DRAFT: FilterDraft = { action: '', resource: '', userId: '', from: '', to: '' };

export function AuditLogPage(): JSX.Element {
  const t = useTranslations('auditLog');
  const s = useAuditLog();
  const [draft, setDraft] = useState<FilterDraft>(EMPTY_DRAFT);
  const [cursorStack, setCursorStack] = useState<string[]>([]);

  const applyFilters = (): void => {
    setCursorStack([]);
    s.setParams({
      action: draft.action || undefined,
      resource: draft.resource || undefined,
      userId: draft.userId || undefined,
      from: draft.from || undefined,
      to: draft.to || undefined,
      cursor: undefined,
    });
  };

  const clearFilters = (): void => {
    setDraft(EMPTY_DRAFT);
    setCursorStack([]);
    s.setParams({
      action: undefined,
      resource: undefined,
      userId: undefined,
      from: undefined,
      to: undefined,
      cursor: undefined,
    });
  };

  const goNext = (): void => {
    const cursor = s.meta?.cursor;
    if (!cursor) return;
    setCursorStack((prev) => [...prev, cursor]);
    s.setParams({ cursor });
  };

  const goPrev = (): void => {
    const newStack = cursorStack.slice(0, -1);
    const cursor = newStack.length > 0 ? newStack[newStack.length - 1] : undefined;
    setCursorStack(newStack);
    s.setParams({ cursor });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t('title')}</h1>
          <p className="mt-1 text-sm text-[--color-muted-foreground]">{t('subtitle')}</p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            exportCsv(s.entries);
          }}
          disabled={s.entries.length === 0}
          className="bg-white text-gray-700 border-gray-300 hover:bg-gray-100 hover:text-gray-900"
        >
          <Download className="me-2 h-4 w-4" />
          {t('export')}
        </Button>
      </div>

      <FilterBar
        draft={draft}
        onDraftChange={setDraft}
        onApply={applyFilters}
        onClear={clearFilters}
      />
      <AuditTable entries={s.entries} loading={s.loading} />

      {s.meta !== null && (
        <PaginationBar meta={s.meta} cursorStack={cursorStack} onNext={goNext} onPrev={goPrev} />
      )}
    </div>
  );
}
