import type { Metadata } from 'next';
import type { JSX } from 'react';

interface Props {
  params: Promise<{ pluginId: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { pluginId } = await params;
  return { title: `Plugin: ${pluginId}` };
}

/**
 * Shell route for plugin-contributed admin pages.
 * Phase 3 will load the plugin's remote entry via Module Federation.
 * For now, this placeholder informs the user the page is forthcoming.
 */
export default async function PluginShellPage({ params }: Props): Promise<JSX.Element> {
  const { pluginId } = await params;
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-center text-muted-foreground">
      <p className="text-sm font-medium">Plugin: {pluginId}</p>
      <p className="text-xs">Custom plugin pages will be available in a future release.</p>
    </div>
  );
}
