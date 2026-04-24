import type { Metadata } from 'next';
import type { JSX } from 'react';

export const metadata: Metadata = { title: 'Webhooks' };

export default function WebhooksPage(): JSX.Element {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Webhooks</h2>
        <p className="text-[--color-muted-foreground]">
          Configure outbound webhooks with HMAC signatures. Coming in Sprint 8.
        </p>
      </div>
      <div className="rounded-lg border border-dashed border-[--color-border] p-12 text-center">
        <p className="text-sm text-[--color-muted-foreground]">No webhooks configured yet.</p>
      </div>
    </div>
  );
}
