import type { Metadata } from 'next';
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

export default function RootLayout({ children }: RootLayoutProps): JSX.Element {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
