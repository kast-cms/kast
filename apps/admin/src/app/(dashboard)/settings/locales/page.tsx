import { LocalesPage } from '@/components/locales/locales-page';
import type { Metadata } from 'next';
import type { JSX } from 'react';

export const metadata: Metadata = { title: 'Locales' };

export default function LocalesRoutePage(): JSX.Element {
  return <LocalesPage />;
}
