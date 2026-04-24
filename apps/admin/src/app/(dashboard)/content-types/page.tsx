import type { Metadata } from 'next';
import type { JSX } from 'react';

export const metadata: Metadata = { title: 'Content Types' };

export default function ContentTypesPage(): JSX.Element {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Content Types</h2>
        <p className="text-[--color-muted-foreground]">
          Define the structure of your content. Coming in Sprint 2.
        </p>
      </div>
      <div className="rounded-lg border border-dashed border-[--color-border] p-12 text-center">
        <p className="text-sm text-[--color-muted-foreground]">No content types yet.</p>
      </div>
    </div>
  );
}
