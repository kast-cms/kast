'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { useApiResource } from '@/lib/use-api-resource';
import { ChevronLeft, Database } from 'lucide-react';
import Link from 'next/link';
import type { JSX } from 'react';
import { EditContentTypeForm } from './edit-form';

interface EditContentTypePageClientProps {
  name: string;
}

function BackToList(): JSX.Element {
  return (
    <Button asChild variant="ghost" size="sm" className="-ms-2 w-fit text-muted-foreground">
      <Link href="/content-types">
        <ChevronLeft className="rtl:rotate-180" />
        Content Types
      </Link>
    </Button>
  );
}

export function EditContentTypePageClient({ name }: EditContentTypePageClientProps): JSX.Element {
  const { data: contentType, loading } = useApiResource(
    async (client) => (await client.contentTypes.get(name)).data,
    `content-type:${name}`,
  );

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader breadcrumb={<BackToList />} title={<Skeleton className="h-7 w-56" />} />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (contentType === null) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader breadcrumb={<BackToList />} title="Content type not found" />
        <EmptyState
          Icon={Database}
          title="Content type not found"
          description={`No content type named "${name}" is available, or you do not have permission to view it.`}
          action={
            <Button asChild>
              <Link href="/content-types">Back to content types</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const hasIcon = contentType.icon !== null && contentType.icon !== '';

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        breadcrumb={<BackToList />}
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
