import { EntryEditorLoader } from '@/components/content/entry-editor-loader';
import type { Metadata } from 'next';
import type { JSX } from 'react';

interface PageProps {
  params: Promise<{ typeId: string; entryId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { typeId } = await params;
  return { title: `Edit ${typeId} entry` };
}

export default async function EditEntryPage({ params }: PageProps): Promise<JSX.Element> {
  const { typeId, entryId } = await params;
  return <EntryEditorLoader typeId={typeId} entryId={entryId} />;
}
