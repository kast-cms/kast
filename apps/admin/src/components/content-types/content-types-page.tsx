'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useApiResource } from '@/lib/use-api-resource';
import type { ContentTypeSummary } from '@kast-cms/sdk';
import { Database, Plus } from 'lucide-react';
import Link from 'next/link';
import type { JSX } from 'react';

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

interface ContentTypesTableProps {
  contentTypes: ContentTypeSummary[];
}

function ContentTypesTable({ contentTypes }: ContentTypesTableProps): JSX.Element {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Display name</TableHead>
          <TableHead>API ID</TableHead>
          <TableHead className="text-end">Fields</TableHead>
          <TableHead className="text-end">Entries</TableHead>
          <TableHead>Last updated</TableHead>
          <TableHead className="w-0">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {contentTypes.map((ct) => (
          <TableRow key={ct.id}>
            <TableCell>
              <div className="flex items-center gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary-subtle text-sm text-primary-subtle-foreground">
                  {ct.icon !== null && ct.icon !== '' ? ct.icon : <Database className="size-4" />}
                </span>
                <span className="font-medium text-foreground">{ct.displayName}</span>
                {ct.isSystem && (
                  <Badge variant="muted" size="sm">
                    System
                  </Badge>
                )}
              </div>
            </TableCell>
            <TableCell>
              <code className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                {ct.name}
              </code>
            </TableCell>
            <TableCell className="text-end text-muted-foreground">{ct.fieldsCount}</TableCell>
            <TableCell className="text-end text-muted-foreground">{ct.entriesCount}</TableCell>
            <TableCell className="whitespace-nowrap text-muted-foreground">
              {formatDate(ct.updatedAt)}
            </TableCell>
            <TableCell className="text-end">
              {!ct.isSystem && (
                <Button asChild variant="ghost" size="sm">
                  <Link href={`/content-types/${ct.name}`}>Edit</Link>
                </Button>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function ContentTypesTableSkeleton(): JSX.Element {
  return (
    <div className="divide-y divide-border">
      <div className="h-10 bg-muted/60" />
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3">
          <Skeleton className="size-8 rounded-md" />
          <Skeleton className="h-3.5 w-1/4" />
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="ms-auto h-3.5 w-24" />
        </div>
      ))}
    </div>
  );
}

export function ContentTypesPageClient(): JSX.Element {
  const { data, loading } = useApiResource(
    async (client) => (await client.contentTypes.list()).data,
    'content-types',
  );
  const contentTypes = data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Content Types"
        description="Define the structure of your content — the fields every entry is built from."
        actions={
          <Button asChild>
            <Link href="/content-types/new">
              <Plus />
              Create content type
            </Link>
          </Button>
        }
      />

      {loading ? (
        <Card className="overflow-hidden">
          <ContentTypesTableSkeleton />
        </Card>
      ) : contentTypes.length === 0 ? (
        <EmptyState
          Icon={Database}
          title="No content types yet"
          description="A content type describes the shape of your content. Create one to start adding entries."
          action={
            <Button asChild>
              <Link href="/content-types/new">
                <Plus />
                Create content type
              </Link>
            </Button>
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <ContentTypesTable contentTypes={contentTypes} />
        </Card>
      )}
    </div>
  );
}
