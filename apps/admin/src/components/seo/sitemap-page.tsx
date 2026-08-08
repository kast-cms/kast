'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Check, Copy, Link2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState, type JSX } from 'react';
import { useSeo } from './use-seo';

/** Placeholder rows that match the real list density while it loads. */
function SitemapSkeleton(): JSX.Element {
  return (
    <Card className="divide-y divide-border overflow-hidden" aria-busy="true">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex items-center justify-between gap-4 px-4 py-2.5">
          <Skeleton className="h-3.5 w-72 max-w-[60%]" />
          <Skeleton className="h-3.5 w-20" />
        </div>
      ))}
    </Card>
  );
}

export function SitemapPage(): JSX.Element {
  const t = useTranslations('seo.sitemap');
  const { sitemapUrls, sitemapLoading, loadSitemap } = useSeo();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void loadSitemap();
  }, [loadSitemap]);

  function handleCopyAll(): void {
    const text = sitemapUrls.map((e) => e.canonicalUrl).join('\n');
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        description={t('description')}
        actions={
          sitemapUrls.length > 0 ? (
            <Button variant="outline" onClick={handleCopyAll}>
              {copied ? <Check className="text-success" /> : <Copy />}
              {copied ? t('copied') : t('copyAll')}
            </Button>
          ) : undefined
        }
      />

      {sitemapLoading ? (
        <SitemapSkeleton />
      ) : sitemapUrls.length === 0 ? (
        <EmptyState Icon={Link2} title={t('empty')} />
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {t('urlCount', { count: sitemapUrls.length })}
          </p>
          <Card className="divide-y divide-border overflow-hidden">
            {sitemapUrls.map((entry) => (
              <div
                key={entry.canonicalUrl}
                className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm transition-colors duration-150 ease-out-quad hover:bg-muted/50"
              >
                <span className="truncate font-mono text-xs text-foreground">
                  {entry.canonicalUrl}
                </span>
                <span className="shrink-0 whitespace-nowrap text-xs tabular-nums text-muted-foreground">
                  {new Date(entry.updatedAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </Card>
        </div>
      )}
    </div>
  );
}
