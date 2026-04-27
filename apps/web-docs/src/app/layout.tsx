import type { Metadata } from 'next';
import './globals.css';
import { DocsNav } from '@/components/docs-nav';

const siteName = process.env.NEXT_PUBLIC_SITE_NAME ?? 'My Docs';
const siteDescription = process.env.NEXT_PUBLIC_SITE_DESCRIPTION ?? 'Documentation powered by Kast CMS';
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3003';

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
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 antialiased">
        <DocsNav />
        {children}
      </body>
    </html>
  );
}
