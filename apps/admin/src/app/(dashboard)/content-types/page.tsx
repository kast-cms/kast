import { ContentTypesPageClient } from '@/components/content-types/content-types-page';
import type { Metadata } from 'next';
import type { JSX } from 'react';

export const metadata: Metadata = { title: 'Content Types' };

export default function ContentTypesPage(): JSX.Element {
  return <ContentTypesPageClient />;
}
