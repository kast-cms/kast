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
import type { ApiTokenSummary } from '@kast-cms/sdk';
import { KeyRound, Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, type JSX } from 'react';
import { CreateTokenDialog } from './create-token-dialog';
import { TokenRevealDialog } from './token-reveal-dialog';
import { useTokens } from './use-tokens';

/**
 * Wider scopes are riskier, so they carry more visual weight in the list.
 * `scope` arrives as a plain string from the API, so an unrecognised value has
 * to land somewhere — a switch says that explicitly, where an object lookup
 * plus `??` reads to TypeScript as a fallback that can never fire.
 */
function scopeVariant(scope: string): 'muted' | 'info' | 'warning' {
  switch (scope) {
    case 'SCOPED':
      return 'info';
    case 'FULL_ACCESS':
      return 'warning';
    default:
      return 'muted';
  }
}

function ScopeBadge({ scope }: { scope: string }): JSX.Element {
  const t = useTranslations('apiTokens.scope');
  return <Badge variant={scopeVariant(scope)}>{t(scope)}</Badge>;
}

function StatusBadge({ revokedAt }: { revokedAt: string | null }): JSX.Element {
  const t = useTranslations('apiTokens');
  const revoked = revokedAt !== null;
  return (
    <Badge variant={revoked ? 'destructive' : 'success'} dot>
      {revoked ? t('status.revoked') : t('status.active')}
    </Badge>
  );
}

function formatDate(date: string | null | undefined): string {
  if (!date) return '—';
  const d = new Date(date);
  return d.toLocaleDateString();
}

/** Placeholder rows so the table keeps its shape while the first load runs. */
function TokensTableSkeleton(): JSX.Element {
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
            <Skeleton className="h-4.5 w-24 rounded-md" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-3.5 w-20" />
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

export function ApiTokensPageClient(): JSX.Element {
  const t = useTranslations('apiTokens');
  const lib = useTokens();
  const [showCreate, setShowCreate] = useState(false);

  const handleRevoke = (token: ApiTokenSummary): void => {
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
              <TableHead>{t('table.scope')}</TableHead>
              <TableHead>{t('table.lastUsed')}</TableHead>
              <TableHead>{t('table.expires')}</TableHead>
              <TableHead>{t('table.status')}</TableHead>
              <TableHead className="w-16 text-end">
                <span className="sr-only">{t('table.actions')}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isEmpty && lib.loading && <TokensTableSkeleton />}
            {isEmpty && !lib.loading && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={7} className="p-0">
                  <EmptyState
                    Icon={KeyRound}
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
                  <ScopeBadge scope={token.scope} />
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {formatDate(token.lastUsedAt)}
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {token.expiresAt ? formatDate(token.expiresAt) : t('noExpiry')}
                </TableCell>
                <TableCell>
                  <StatusBadge revokedAt={token.revokedAt} />
                </TableCell>
                <TableCell className="text-end">
                  {token.revokedAt === null && (
                    <Hint label={t('revoke')}>
                      <Button
                        variant="ghost-destructive"
                        size="icon-sm"
                        aria-label={t('revoke')}
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

      <CreateTokenDialog open={showCreate} onOpenChange={setShowCreate} onCreate={lib.create} />

      <TokenRevealDialog token={lib.createdToken} onClose={lib.clearCreatedToken} />
    </div>
  );
}
