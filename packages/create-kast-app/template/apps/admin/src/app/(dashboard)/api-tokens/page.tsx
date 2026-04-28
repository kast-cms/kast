import { ApiTokensPageClient } from '@/components/api-tokens/tokens-page';
import type { Metadata } from 'next';
import type { JSX } from 'react';
export const metadata: Metadata = { title: 'API Tokens' };
export default function ApiTokensPage(): JSX.Element {
  return <ApiTokensPageClient />;
}
