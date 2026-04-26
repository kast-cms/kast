import { AgentTokensPageClient } from '@/components/agent-tokens/agent-tokens-page';
import type { Metadata } from 'next';
import type { JSX } from 'react';

export const metadata: Metadata = { title: 'Agent Tokens' };

export default function AgentTokensPage(): JSX.Element {
  return <AgentTokensPageClient />;
}
