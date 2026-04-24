import type { Metadata } from 'next';
import type { JSX } from 'react';

export const metadata: Metadata = { title: 'Agent Tokens' };

export default function AgentTokensPage(): JSX.Element {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Agent Tokens</h2>
        <p className="text-[--color-muted-foreground]">
          Scoped tokens for AI agents accessing the MCP server. Coming in Sprint 6.
        </p>
      </div>
      <div className="rounded-lg border border-dashed border-[--color-border] p-12 text-center">
        <p className="text-sm text-[--color-muted-foreground]">No agent tokens yet.</p>
      </div>
    </div>
  );
}
