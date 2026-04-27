import { EntryListClient } from '@/components/content/entry-list';
import { createServerApiClient } from '@/lib/api';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { JSX } from 'react';

interface PageProps {
  params: Promise<{ typeId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { typeId } = await params;
  return { title: typeId };
}

export default async function ContentListPage({ params }: PageProps): Promise<JSX.Element> {
  const { typeId } = await params;
  let displayName = typeId;
  try {
    const res = await createServerApiClient().contentTypes.get(typeId);
    displayName = res.data.displayName;
  } catch {
    notFound();
  }
  return <EntryListClient typeId={typeId} displayName={displayName} />;
}
