import { WebhooksPageClient } from '@/components/webhooks/webhooks-page';
import type { Metadata } from 'next';
import type { JSX } from 'react';

export const metadata: Metadata = { title: 'Webhooks' };

export default function WebhooksPage(): JSX.Element {
  return <WebhooksPageClient />;
}
