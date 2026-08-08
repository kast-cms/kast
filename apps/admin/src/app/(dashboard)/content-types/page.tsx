import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { createServerApiClient } from '@/lib/api';
import type { ContentTypeSummary } from '@kast-cms/sdk';
import { Database, Plus } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { JSX } from 'react';

export const metadata: Metadata = { title: 'Content Types' };

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

export default async function ContentTypesPage(): Promise<JSX.Element> {
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

      {contentTypes.length === 0 ? (
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
