import type { Metadata } from 'next';
import { getLocale } from 'next-intl/server';
import type { JSX, ReactNode } from 'react';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: {
    default: 'Kast CMS',
    template: '%s | Kast CMS',
  },
  description: 'Kast CMS Admin Panel',
  robots: { index: false, follow: false },
};

interface RootLayoutProps {
  children: ReactNode;
}

const RTL_LOCALES = new Set(['ar']);

export default async function RootLayout({ children }: RootLayoutProps): Promise<JSX.Element> {
  const locale = await getLocale();
  const dir = RTL_LOCALES.has(locale) ? 'rtl' : 'ltr';

  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
