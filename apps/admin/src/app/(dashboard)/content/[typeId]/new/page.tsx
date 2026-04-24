import { EntryEditor } from '@/components/content/entry-editor';
import { createServerApiClient } from '@/lib/api';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
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
  try {
    const res = await createServerApiClient().contentTypes.get(typeId);
    return <EntryEditor typeId={typeId} contentType={res.data} entry={null} />;
  } catch {
    notFound();
  }
}
