'use client';

import { Button } from '@/components/ui/button';
import type { AuditLogEntry, AuditLogListParams } from '@kast-cms/sdk';
import { Download } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, type JSX } from 'react';
import { AuditTable, FilterBar, PaginationBar, type FilterDraft } from './audit-log-parts';
import { useAuditLog } from './use-audit-log';

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

function buildFilterParams(draft: FilterDraft): AuditLogListParams {
  const next: AuditLogListParams = { limit: 20 };
  if (draft.action) next.action = draft.action;
  if (draft.resource) next.resource = draft.resource;
  if (draft.userId) next.userId = draft.userId;
  if (draft.from) next.from = draft.from;
  if (draft.to) next.to = draft.to;
  return next;
}

const EMPTY_DRAFT: FilterDraft = { action: '', resource: '', userId: '', from: '', to: '' };

export function AuditLogPage(): JSX.Element {
  const t = useTranslations('auditLog');
  const s = useAuditLog();
  const [draft, setDraft] = useState<FilterDraft>(EMPTY_DRAFT);
  const [cursorStack, setCursorStack] = useState<string[]>([]);

  const applyFilters = (): void => {
    setCursorStack([]);
    s.setParams(buildFilterParams(draft));
  };

  const clearFilters = (): void => {
    setDraft(EMPTY_DRAFT);
    setCursorStack([]);
    s.setParams({ limit: 20 });
  };

  const goNext = (): void => {
    const cursor = s.meta?.cursor;
    if (!cursor) return;
    setCursorStack((prev) => [...prev, cursor]);
    s.setParams({ ...s.params, cursor });
  };

  const goPrev = (): void => {
    const newStack = cursorStack.slice(0, -1);
    setCursorStack(newStack);
    const { cursor: _c, ...rest } = s.params;
    const prevCursor = newStack.at(-1);
    if (prevCursor !== undefined) {
      s.setParams({ ...rest, cursor: prevCursor });
    } else {
      s.setParams(rest);
    }
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
