import { EntryEditor } from '@/components/content/entry-editor';
import { createServerApiClient } from '@/lib/api';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
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
  try {
    const [typeRes, entryRes] = await Promise.all([
      createServerApiClient().contentTypes.get(typeId),
      createServerApiClient().content.get(typeId, entryId),
    ]);
    return <EntryEditor typeId={typeId} contentType={typeRes.data} entry={entryRes.data} />;
  } catch {
    notFound();
  }
}
