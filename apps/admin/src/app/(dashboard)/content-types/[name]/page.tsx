import { Button } from '@/components/ui/button';
import { createServerApiClient } from '@/lib/api';
import type { ContentTypeDetail } from '@kast-cms/sdk';
import { ChevronLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { JSX } from 'react';
import { EditContentTypeForm } from './edit-form';

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
  const client = createServerApiClient();

  let contentType: ContentTypeDetail;
  try {
    const result = await client.contentTypes.get(name);
    contentType = result.data;
  } catch {
    notFound();
  }

  return (
    <div className="mx-auto max-w-3xl flex flex-col gap-y-6">
      <div className="flex items-center gap-x-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/content-types">
            <ChevronLeft className="me-1 h-4 w-4" />
            Content Types
          </Link>
        </Button>
      </div>

      <div className="flex items-center gap-x-3">
        {contentType.icon !== null && contentType.icon !== '' && (
          <span className="text-3xl">{contentType.icon}</span>
        )}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{contentType.displayName}</h1>
          <code className="text-sm text-muted-foreground">{contentType.name}</code>
        </div>
      </div>

      <EditContentTypeForm initialData={contentType} />
    </div>
  );
}
