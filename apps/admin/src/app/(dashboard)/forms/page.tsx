import type { Metadata } from 'next';
import type { JSX } from 'react';

export const metadata: Metadata = { title: 'Forms' };

export default function FormsPage(): JSX.Element {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Forms</h2>
        <p className="text-[--color-muted-foreground]">
          Build and manage embeddable forms. Coming in Sprint 9.
        </p>
      </div>
      <div className="rounded-lg border border-dashed border-[--color-border] p-12 text-center">
        <p className="text-sm text-[--color-muted-foreground]">No forms yet.</p>
      </div>
    </div>
  );
}
