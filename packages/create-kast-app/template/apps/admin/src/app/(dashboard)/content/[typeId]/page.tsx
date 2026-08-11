import { EntryListClient } from '@/components/content/entry-list';
import type { Metadata } from 'next';
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
  return <EntryListClient typeId={typeId} />;
}
