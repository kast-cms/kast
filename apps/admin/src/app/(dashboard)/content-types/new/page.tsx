import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { ChevronLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { JSX } from 'react';
import { CreateContentTypeForm } from './create-form';

export const metadata: Metadata = { title: 'Create Content Type' };

export default function NewContentTypePage(): JSX.Element {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        breadcrumb={
          <Button asChild variant="ghost" size="sm" className="-ms-2 w-fit text-muted-foreground">
            <Link href="/content-types">
              <ChevronLeft className="rtl:rotate-180" />
              Content Types
            </Link>
          </Button>
        }
        title="Create content type"
        description="Name it and give it an API ID — fields can be added as soon as it exists."
      />

      <CreateContentTypeForm />
    </div>
  );
}
