import { FormsListClient } from '@/components/forms/forms-list';
import type { Metadata } from 'next';
import type { JSX } from 'react';

export const metadata: Metadata = { title: 'Forms' };

export default function FormsPage(): JSX.Element {
  return <FormsListClient />;
}
