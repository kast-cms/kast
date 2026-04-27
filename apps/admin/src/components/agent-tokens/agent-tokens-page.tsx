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
import type { AgentTokenSummary } from '@kast/sdk';
import { Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, type JSX } from 'react';
import { AgentTokenRevealDialog } from './agent-token-reveal-dialog';
import { CreateAgentTokenDrawer } from './create-agent-token-drawer';
import { useAgentTokens } from './use-agent-tokens';

function StatusBadge({ revokedAt }: { revokedAt: string | null }): JSX.Element {
  const t = useTranslations('agentTokens.status');
  const revoked = revokedAt !== null;
  return (
    <Badge
      variant={revoked ? 'outline' : 'default'}
      className={revoked ? 'border-destructive text-destructive' : ''}
    >
      {revoked ? t('revoked') : t('active')}
    </Badge>
  );
}

function formatDate(date: string | null | undefined): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString();
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
            <TableHead>{t('table.scopes')}</TableHead>
            <TableHead>{t('table.lastUsed')}</TableHead>
            <TableHead>{t('table.status')}</TableHead>
            <TableHead className="w-16" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {lib.tokens.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="py-10 text-center text-[--color-muted-foreground]">
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
                <div className="flex flex-wrap gap-1">
                  {token.scopes.map((s) => (
                    <Badge key={s} variant="secondary" className="font-mono text-xs">
                      {s}
                    </Badge>
                  ))}
                </div>
              </TableCell>
              <TableCell>{formatDate(token.lastUsedAt)}</TableCell>
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

      <CreateAgentTokenDrawer
        open={showCreate}
        onOpenChange={setShowCreate}
        onCreate={lib.create}
      />
      <AgentTokenRevealDialog token={lib.createdToken} onClose={lib.clearCreatedToken} />
    </div>
  );
}
