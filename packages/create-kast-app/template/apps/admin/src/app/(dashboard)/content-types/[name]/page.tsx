import type { Metadata } from 'next';
import type { JSX } from 'react';
import { EditContentTypePageClient } from './edit-page-client';

interface ContentTypePageProps {
  params: Promise<{ name: string }>;
}

export async function generateMetadata({ params }: ContentTypePageProps): Promise<Metadata> {
  const { name } = await params;
  return { title: `Edit — ${name}` };
}

export default async function ContentTypePage({
  params,
}: ContentTypePageProps): Promise<JSX.Element> {
  const { name } = await params;
  return <EditContentTypePageClient name={name} />;
}
