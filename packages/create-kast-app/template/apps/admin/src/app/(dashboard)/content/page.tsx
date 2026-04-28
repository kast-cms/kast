import type { Metadata } from 'next';
import type { JSX } from 'react';

export const metadata: Metadata = { title: 'Content' };

export default function ContentPage(): JSX.Element {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Content</h2>
        <p className="text-[--color-muted-foreground]">
          Browse and edit your content entries. Coming in Sprint 3.
        </p>
      </div>
      <div className="rounded-lg border border-dashed border-[--color-border] p-12 text-center">
        <p className="text-sm text-[--color-muted-foreground]">No content entries yet.</p>
      </div>
    </div>
  );
}
