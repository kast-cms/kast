import { PluginsPageClient } from '@/components/plugins/plugins-page';
import type { Metadata } from 'next';
import type { JSX } from 'react';

export const metadata: Metadata = { title: 'Plugins' };

export default function PluginsPage(): JSX.Element {
  return <PluginsPageClient />;
}
