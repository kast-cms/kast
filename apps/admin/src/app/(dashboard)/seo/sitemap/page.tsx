import { SitemapPage } from '@/components/seo/sitemap-page';
import type { Metadata } from 'next';
import type { JSX } from 'react';

export const metadata: Metadata = { title: 'Sitemap' };

export default function SeoSitemapPage(): JSX.Element {
  return <SitemapPage />;
}
