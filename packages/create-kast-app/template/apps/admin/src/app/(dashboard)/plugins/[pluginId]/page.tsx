import { PluginDetailClient } from '@/components/plugins/plugin-detail';
import type { Metadata } from 'next';
import type { JSX } from 'react';

interface Props {
  params: Promise<{ pluginId: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { pluginId } = await params;
  return { title: `Plugin: ${pluginId}` };
}

export default async function PluginShellPage({ params }: Props): Promise<JSX.Element> {
  const { pluginId } = await params;
  return <PluginDetailClient pluginId={pluginId} />;
}
