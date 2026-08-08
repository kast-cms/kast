import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { createServerApiClient } from '@/lib/api';
import type { ContentTypeSummary } from '@kast-cms/sdk';
import { Database, FileText, Plus } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import type { JSX } from 'react';

export const metadata: Metadata = { title: 'Content' };

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

export default async function ContentPage(): Promise<JSX.Element> {
  const t = await getTranslations('content');
  const tLanding = await getTranslations('content.landing');
  const client = createServerApiClient();
  let contentTypes: ContentTypeSummary[] = [];

  try {
    const result = await client.contentTypes.list();
    contentTypes = result.data;
  } catch {
    // Show empty state on error — auth errors handled by middleware
  }

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

      {contentTypes.length === 0 ? (
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
