'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Hint } from '@/components/ui/tooltip';
import type { AgentTokenSummary } from '@kast-cms/sdk';
import { Bot, Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, type JSX } from 'react';
import { AgentTokenRevealDialog } from './agent-token-reveal-dialog';
import { CreateAgentTokenDrawer } from './create-agent-token-drawer';
import { useAgentTokens } from './use-agent-tokens';

function StatusBadge({ revokedAt }: { revokedAt: string | null }): JSX.Element {
  const t = useTranslations('agentTokens.status');
  const revoked = revokedAt !== null;
  return (
    <Badge variant={revoked ? 'destructive' : 'success'} dot>
      {revoked ? t('revoked') : t('active')}
    </Badge>
  );
}

function formatDate(date: string | null | undefined): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString();
}

/** Placeholder rows so the table keeps its shape while the first load runs. */
function AgentTokensTableSkeleton(): JSX.Element {
  return (
    <>
      {Array.from({ length: 4 }, (_, i) => (
        <TableRow key={i} className="hover:bg-transparent">
          <TableCell>
            <Skeleton className="h-3.5 w-32" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4.5 w-20 rounded-sm" />
          </TableCell>
          <TableCell>
            <div className="flex gap-1">
              <Skeleton className="h-4.5 w-24 rounded-md" />
              <Skeleton className="h-4.5 w-20 rounded-md" />
            </div>
          </TableCell>
          <TableCell>
            <Skeleton className="h-3.5 w-20" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4.5 w-16 rounded-md" />
          </TableCell>
          <TableCell>
            <Skeleton className="ms-auto size-7 rounded-md" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

export function AgentTokensPageClient(): JSX.Element {
  const t = useTranslations('agentTokens');
  const lib = useAgentTokens();
  const [showCreate, setShowCreate] = useState(false);

  const handleRevoke = (token: AgentTokenSummary): void => {
    const msg = t('revokeConfirm', { name: token.name });
    if (!window.confirm(msg)) return;
    void lib.revoke(token.id);
  };

  const isEmpty = lib.tokens.length === 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        description={t('description')}
        actions={
          <Button onClick={() => setShowCreate(true)}>
            <Plus />
            {t('create')}
          </Button>
        }
      />

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('table.name')}</TableHead>
              <TableHead>{t('table.prefix')}</TableHead>
              <TableHead>{t('table.scopes')}</TableHead>
              <TableHead>{t('table.lastUsed')}</TableHead>
              <TableHead>{t('table.status')}</TableHead>
              <TableHead className="w-16 text-end">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isEmpty && lib.loading && <AgentTokensTableSkeleton />}
            {isEmpty && !lib.loading && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6} className="p-0">
                  <EmptyState
                    Icon={Bot}
                    size="sm"
                    title={t('noTokens')}
                    description={t('description')}
                    className="rounded-none border-0"
                    action={
                      <Button variant="outline" size="sm" onClick={() => setShowCreate(true)}>
                        <Plus />
                        {t('create')}
                      </Button>
                    }
                  />
                </TableCell>
              </TableRow>
            )}
            {lib.tokens.map((token) => (
              <TableRow key={token.id}>
                <TableCell className="font-medium text-foreground">{token.name}</TableCell>
                <TableCell>
                  <code className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                    {token.prefix}
                  </code>
                </TableCell>
                <TableCell>
                  <div className="flex max-w-md flex-wrap gap-1">
                    {token.scopes.length === 0 && <span className="text-muted-foreground">—</span>}
                    {token.scopes.map((s) => (
                      <Badge key={s} variant="muted" size="sm" className="font-mono">
                        {s}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {formatDate(token.lastUsedAt)}
                </TableCell>
                <TableCell>
                  <StatusBadge revokedAt={token.revokedAt} />
                </TableCell>
                <TableCell className="text-end">
                  {token.revokedAt === null && (
                    <Hint label="Revoke">
                      <Button
                        variant="ghost-destructive"
                        size="icon-sm"
                        aria-label="Revoke"
                        onClick={() => handleRevoke(token)}
                      >
                        <Trash2 />
                      </Button>
                    </Hint>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <CreateAgentTokenDrawer
        open={showCreate}
        onOpenChange={setShowCreate}
        onCreate={lib.create}
      />
      <AgentTokenRevealDialog token={lib.createdToken} onClose={lib.clearCreatedToken} />
    </div>
  );
}
