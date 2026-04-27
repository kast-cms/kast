import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { JSX } from 'react';
import { CreateContentTypeForm } from './create-form';

export const metadata: Metadata = { title: 'Create Content Type' };

export default function NewContentTypePage(): JSX.Element {
  return (
    <div className="mx-auto max-w-2xl flex flex-col gap-y-6">
      <div className="flex items-center gap-x-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/content-types">
            <ChevronLeft className="me-1 h-4 w-4" />
            Back
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Create content type</h1>
        <p className="text-sm text-muted-foreground">Define a new content type for your project.</p>
      </div>

      <div className="rounded-lg border p-6">
        <CreateContentTypeForm />
      </div>
    </div>
  );
}
