'use client';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { useApiResource } from '@/lib/use-api-resource';
import type { ContentEntryDetail, ContentTypeDetail } from '@kast-cms/sdk';
import { FileWarning } from 'lucide-react';
import Link from 'next/link';
import type { JSX } from 'react';
import { EntryEditor } from './entry-editor';

interface EntryEditorLoaderProps {
  typeId: string;
  /** Omitted for the "new entry" route. */
  entryId?: string;
}

interface EditorPayload {
  contentType: ContentTypeDetail;
  entry: ContentEntryDetail | null;
}

function EditorSkeleton(): JSX.Element {
  return (
    <div className="space-y-6">
      <PageHeader title={<Skeleton className="h-7 w-48" />} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Skeleton className="h-96 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    </div>
  );
}

/**
 * Loads the content type (and, when editing, the entry) from the browser so
 * the request carries the session's access token. These reads used to happen
 * in a server component with no credential, which now returns 401 and made the
 * editor unreachable.
 */
export function EntryEditorLoader({ typeId, entryId }: EntryEditorLoaderProps): JSX.Element {
  const { data, loading } = useApiResource<EditorPayload>(
    async (client) => {
      const typeRes = await client.contentTypes.get(typeId);
      if (entryId === undefined) {
        return { contentType: typeRes.data, entry: null };
      }
      const entryRes = await client.content.get(typeId, entryId);
      return { contentType: typeRes.data, entry: entryRes.data };
    },
    `entry-editor:${typeId}:${entryId ?? 'new'}`,
  );

  if (loading) return <EditorSkeleton />;

  if (data === null) {
    return (
      <div className="space-y-6">
        <PageHeader title="Entry unavailable" />
        <EmptyState
          Icon={FileWarning}
          title="This entry could not be loaded"
          description="It may have been deleted, or you may not have permission to view it."
          action={
            <Button asChild>
              <Link href={`/content/${typeId}`}>Back to entries</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return <EntryEditor typeId={typeId} contentType={data.contentType} entry={data.entry} />;
}
