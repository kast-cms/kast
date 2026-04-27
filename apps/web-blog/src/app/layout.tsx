import type { Metadata } from 'next';
import './globals.css';
import { SiteNav } from '@/components/site-nav';
import { SiteFooter } from '@/components/site-footer';

const siteName = process.env.NEXT_PUBLIC_SITE_NAME ?? 'My Blog';
const siteDescription = process.env.NEXT_PUBLIC_SITE_DESCRIPTION ?? 'A blog powered by Kast CMS';
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3002';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: siteName,
    template: `%s — ${siteName}`,
  },
  description: siteDescription,
  openGraph: {
    type: 'website',
    siteName,
    locale: 'en_US',
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    types: {
      'application/rss+xml': `${siteUrl}/feed.xml`,
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen flex flex-col bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 antialiased">
        <SiteNav />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
