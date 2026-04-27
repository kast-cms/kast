'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { ApiTokenSummary } from '@kast-cms/sdk';
import { Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, type JSX } from 'react';
import { CreateTokenDialog } from './create-token-dialog';
import { TokenRevealDialog } from './token-reveal-dialog';
import { useTokens } from './use-tokens';

function ScopeBadge({ scope }: { scope: string }): JSX.Element {
  const t = useTranslations('apiTokens.scope');
  return <Badge variant="secondary">{t(scope)}</Badge>;
}

function StatusBadge({ revokedAt }: { revokedAt: string | null }): JSX.Element {
  const t = useTranslations('apiTokens');
  const revoked = revokedAt !== null;
  return (
    <Badge
      variant={revoked ? 'outline' : 'default'}
      className={revoked ? 'text-destructive border-destructive' : ''}
    >
      {revoked ? t('status.revoked') : t('status.active')}
    </Badge>
  );
}

function formatDate(date: string | null | undefined): string {
  if (!date) return '—';
  const d = new Date(date);
  return d.toLocaleDateString();
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t('title')}</h1>
          <p className="mt-1 text-sm text-[--color-muted-foreground]">{t('description')}</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="me-2 h-4 w-4" />
          {t('create')}
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('table.name')}</TableHead>
            <TableHead>{t('table.prefix')}</TableHead>
            <TableHead>{t('table.scope')}</TableHead>
            <TableHead>{t('table.lastUsed')}</TableHead>
            <TableHead>{t('table.expires')}</TableHead>
            <TableHead>{t('table.status')}</TableHead>
            <TableHead className="w-24" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {lib.tokens.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="py-10 text-center text-[--color-muted-foreground]">
                {lib.loading ? '…' : t('noTokens')}
              </TableCell>
            </TableRow>
          )}
          {lib.tokens.map((token) => (
            <TableRow key={token.id}>
              <TableCell>{token.name}</TableCell>
              <TableCell>
                <span className="font-mono text-xs">{token.prefix}</span>
              </TableCell>
              <TableCell>
                <ScopeBadge scope={token.scope} />
              </TableCell>
              <TableCell>{formatDate(token.lastUsedAt)}</TableCell>
              <TableCell>{token.expiresAt ? formatDate(token.expiresAt) : t('noExpiry')}</TableCell>
              <TableCell>
                <StatusBadge revokedAt={token.revokedAt} />
              </TableCell>
              <TableCell>
                {token.revokedAt === null && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleRevoke(token)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <CreateTokenDialog open={showCreate} onOpenChange={setShowCreate} onCreate={lib.create} />

      <TokenRevealDialog token={lib.createdToken} onClose={lib.clearCreatedToken} />
    </div>
  );
}
