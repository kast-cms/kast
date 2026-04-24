import { MediaPageClient } from '@/components/media/media-page';
import type { Metadata } from 'next';
import type { JSX } from 'react';

export const metadata: Metadata = { title: 'Media Library' };

export default function MediaPage(): JSX.Element {
  return <MediaPageClient />;
}
