import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { createServerApiClient } from '@/lib/api';
import type { ContentTypeDetail } from '@kast-cms/sdk';
import { ChevronLeft, Database } from 'lucide-react';
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

  const hasIcon = contentType.icon !== null && contentType.icon !== '';

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        breadcrumb={
          <Button asChild variant="ghost" size="sm" className="-ms-2 w-fit text-muted-foreground">
            <Link href="/content-types">
              <ChevronLeft className="rtl:rotate-180" />
              Content Types
            </Link>
          </Button>
        }
        title={
          <span className="flex min-w-0 items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-subtle text-lg text-primary-subtle-foreground">
              {hasIcon ? contentType.icon : <Database className="size-4.5" />}
            </span>
            <span className="truncate">{contentType.displayName}</span>
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <code className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-xs">
              {contentType.name}
            </code>
            {contentType.description !== null && contentType.description !== '' && (
              <span>{contentType.description}</span>
            )}
          </span>
        }
        actions={
          contentType.isSystem ? (
            <Badge variant="muted" dot>
              System type
            </Badge>
          ) : undefined
        }
      />

      <EditContentTypeForm initialData={contentType} />
    </div>
  );
}
