import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { createServerApiClient } from '@/lib/api';
import type { ContentTypeSummary } from '@kast/sdk';
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

function EmptyState(): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-20 text-center">
      <Database className="mb-4 h-12 w-12 text-muted-foreground" />
      <h3 className="mb-1 text-lg font-semibold">No content types yet</h3>
      <p className="mb-6 text-sm text-muted-foreground">
        Get started by creating your first content type.
      </p>
      <Button asChild>
        <Link href="/content-types/new">
          <Plus className="me-2 h-4 w-4" />
          Create content type
        </Link>
      </Button>
    </div>
  );
}

interface ContentTypesTableProps {
  contentTypes: ContentTypeSummary[];
}

function ContentTypesTable({ contentTypes }: ContentTypesTableProps): JSX.Element {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Display Name</TableHead>
          <TableHead>API ID</TableHead>
          <TableHead>Fields</TableHead>
          <TableHead>Entries</TableHead>
          <TableHead>Last Updated</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {contentTypes.map((ct) => (
          <TableRow key={ct.id}>
            <TableCell>
              <div className="flex items-center gap-x-2">
                {ct.icon !== null && ct.icon !== '' && <span className="text-lg">{ct.icon}</span>}
                <span className="font-medium">{ct.displayName}</span>
                {ct.isSystem && (
                  <Badge variant="secondary" className="text-xs">
                    System
                  </Badge>
                )}
              </div>
            </TableCell>
            <TableCell>
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">{ct.name}</code>
            </TableCell>
            <TableCell>{ct.fieldsCount}</TableCell>
            <TableCell>{ct.entriesCount}</TableCell>
            <TableCell className="text-muted-foreground">{formatDate(ct.updatedAt)}</TableCell>
            <TableCell>
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
    <div className="flex flex-col gap-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Content Types</h1>
          <p className="text-sm text-muted-foreground">Define the structure of your content.</p>
        </div>
        <Button asChild>
          <Link href="/content-types/new">
            <Plus className="me-2 h-4 w-4" />
            Create content type
          </Link>
        </Button>
      </div>

      {contentTypes.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="rounded-lg border">
          <ContentTypesTable contentTypes={contentTypes} />
        </div>
      )}
    </div>
  );
}
