import { Button } from '@/components/ui/button';
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
      className="group flex flex-col gap-y-3 rounded-lg border border-[--color-border] bg-[--color-background] p-5 transition-colors hover:border-[--color-primary] hover:bg-[--color-accent]"
    >
      <div className="flex items-center gap-x-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[--color-muted] text-lg">
          {icon !== null && icon !== '' ? (
            icon
          ) : (
            <FileText className="h-5 w-5 text-[--color-muted-foreground]" />
          )}
        </span>
        <div className="min-w-0">
          <p className="truncate font-medium">{displayName}</p>
          <code className="text-xs text-[--color-muted-foreground]">{name}</code>
        </div>
      </div>
      <p className="text-sm text-[--color-muted-foreground]">{entriesLabel}</p>
    </Link>
  );
}

async function EmptyState(): Promise<JSX.Element> {
  const t = await getTranslations('content.landing');
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[--color-border] py-20 text-center">
      <Database className="mb-4 h-12 w-12 text-[--color-muted-foreground]" />
      <h3 className="mb-1 text-lg font-semibold">{t('emptyTitle')}</h3>
      <p className="mb-6 text-sm text-[--color-muted-foreground]">{t('emptyDescription')}</p>
      <Button asChild>
        <Link href="/content-types/new">
          <Plus className="me-2 h-4 w-4" />
          {t('manageTypes')}
        </Link>
      </Button>
    </div>
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
    <div className="flex flex-col gap-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-sm text-[--color-muted-foreground]">{tLanding('description')}</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/content-types">{tLanding('manageTypes')}</Link>
        </Button>
      </div>

      {contentTypes.length === 0 ? (
        <EmptyState />
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
