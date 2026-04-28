import { RedirectsPage } from '@/components/seo/redirects-page';
import type { Metadata } from 'next';
import type { JSX } from 'react';

export const metadata: Metadata = { title: 'SEO Redirects' };

export default function SeoRedirectsPage(): JSX.Element {
  return <RedirectsPage />;
}
