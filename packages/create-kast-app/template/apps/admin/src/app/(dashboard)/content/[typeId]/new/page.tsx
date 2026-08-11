import { EntryEditorLoader } from '@/components/content/entry-editor-loader';
import type { Metadata } from 'next';
import type { JSX } from 'react';

interface PageProps {
  params: Promise<{ typeId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { typeId } = await params;
  return { title: `New ${typeId} entry` };
}

export default async function NewEntryPage({ params }: PageProps): Promise<JSX.Element> {
  const { typeId } = await params;
  return <EntryEditorLoader typeId={typeId} />;
}
