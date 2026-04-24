import type { Metadata } from 'next';
import type { JSX } from 'react';

export const metadata: Metadata = { title: 'SEO' };

export default function SeoPage(): JSX.Element {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">SEO</h2>
        <p className="text-[--color-muted-foreground]">
          Monitor and optimize your content for search engines. Coming in Sprint 5.
        </p>
      </div>
      <div className="rounded-lg border border-dashed border-[--color-border] p-12 text-center">
        <p className="text-sm text-[--color-muted-foreground]">No SEO data yet.</p>
      </div>
    </div>
  );
}
