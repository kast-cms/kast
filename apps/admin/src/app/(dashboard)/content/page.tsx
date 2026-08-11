import { ContentLandingClient } from '@/components/content/content-landing';
import type { Metadata } from 'next';
import type { JSX } from 'react';

export const metadata: Metadata = { title: 'Content' };

export default function ContentPage(): JSX.Element {
  return <ContentLandingClient />;
}
