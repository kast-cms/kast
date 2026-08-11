'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { useApiResource } from '@/lib/use-api-resource';
import type { ContentTypeSummary } from '@kast-cms/sdk';
import { Database, FileText, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import type { JSX } from 'react';

interface ContentTypeCardProps {
  contentType: ContentTypeSummary;
  entriesLabel: string;
}

function ContentTypeCard({ contentType, entriesLabel }: ContentTypeCardProps): JSX.Element {
  const { name, displayName, icon } = contentType;
  return (
    <Link
      href={`/content/${name}`}
      className="group rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <Card interactive className="flex h-full flex-col gap-4 p-5">
        <div className="flex items-center gap-x-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary-subtle text-md text-primary-subtle-foreground">
            {icon !== null && icon !== '' ? icon : <FileText className="size-5" />}
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground transition-colors duration-150 ease-out-quad group-hover:text-primary">
              {displayName}
            </p>
            <code className="text-2xs text-muted-foreground">{name}</code>
          </div>
        </div>
        <p className="mt-auto text-sm text-muted-foreground">{entriesLabel}</p>
      </Card>
    </Link>
  );
}

function ContentTypeCardSkeleton(): JSX.Element {
  return (
    <Card className="flex h-full flex-col gap-4 p-5">
      <div className="flex items-center gap-x-3">
        <Skeleton className="size-10 shrink-0 rounded-lg" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
      <Skeleton className="mt-auto h-3.5 w-20" />
    </Card>
  );
}

export function ContentLandingClient(): JSX.Element {
  const t = useTranslations('content');
  const tLanding = useTranslations('content.landing');
  const { data, loading } = useApiResource(
    async (client) => (await client.contentTypes.list()).data,
    'content-types',
  );
  const contentTypes = data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        description={tLanding('description')}
        actions={
          <Button asChild variant="outline">
            <Link href="/content-types">{tLanding('manageTypes')}</Link>
          </Button>
        }
      />

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <ContentTypeCardSkeleton key={i} />
          ))}
        </div>
      ) : contentTypes.length === 0 ? (
        <EmptyState
          Icon={Database}
          title={tLanding('emptyTitle')}
          description={tLanding('emptyDescription')}
          action={
            <Button asChild>
              <Link href="/content-types/new">
                <Plus />
                {tLanding('manageTypes')}
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {contentTypes.map((ct) => (
            <ContentTypeCard
              key={ct.id}
              contentType={ct}
              entriesLabel={tLanding('entries', { count: ct.entriesCount })}
            />
          ))}
        </div>
      )}
    </div>
  );
}
