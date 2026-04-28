'use client';

import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';
import { useEffect, useState, type JSX } from 'react';
import { useSeo } from './use-seo';

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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{t('title')}</h2>
          <p className="text-sm text-muted-foreground">{t('description')}</p>
        </div>
        {sitemapUrls.length > 0 && (
          <Button variant="outline" onClick={handleCopyAll}>
            {copied ? t('copied') : t('copyAll')}
          </Button>
        )}
      </div>

      {sitemapLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : sitemapUrls.length === 0 ? (
        <div className="rounded border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
        </div>
      ) : (
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">
            {t('urlCount', { count: sitemapUrls.length })}
          </p>
          <div className="rounded border divide-y">
            {sitemapUrls.map((entry) => (
              <div
                key={entry.canonicalUrl}
                className="flex items-center justify-between px-4 py-2 text-sm"
              >
                <span className="font-mono">{entry.canonicalUrl}</span>
                <span className="text-muted-foreground">
                  {new Date(entry.updatedAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
