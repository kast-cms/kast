import { fontVariables } from '@/lib/fonts';
import type { Metadata, Viewport } from 'next';
import { getLocale } from 'next-intl/server';
import type { JSX, ReactNode } from 'react';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: {
    default: 'Kast CMS',
    template: '%s · Kast CMS',
  },
  description: 'Kast CMS Admin Panel',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  // Matches --background in each theme so the browser chrome, the pull-to-refresh
  // overshoot and the address bar all blend into the app instead of flashing white.
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fbfbfe' },
    { media: '(prefers-color-scheme: dark)', color: '#0d0c11' },
  ],
  colorScheme: 'light dark',
};

interface RootLayoutProps {
  children: ReactNode;
}

const RTL_LOCALES = new Set(['ar']);

/*
 * Runs before first paint, so the correct theme class is on <html> by the time
 * anything renders — no white flash on a dark-mode reload. Kept inline and
 * dependency-free because a deferred script is already too late.
 */
const THEME_SCRIPT = `(function(){try{var s=localStorage.getItem('kast-theme');var d=s==='dark'||((s===null||s==='system')&&matchMedia('(prefers-color-scheme: dark)').matches);var e=document.documentElement;e.classList.toggle('dark',d);e.style.colorScheme=d?'dark':'light';}catch(_){}})();`;

export default async function RootLayout({ children }: RootLayoutProps): Promise<JSX.Element> {
  const locale = await getLocale();
  const dir = RTL_LOCALES.has(locale) ? 'rtl' : 'ltr';

  return (
    <html lang={locale} dir={dir} className={fontVariables} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
