import { SubmissionsLoader } from '@/components/forms/submissions-loader';
import type { Metadata } from 'next';
import type { JSX } from 'react';

export const metadata: Metadata = { title: 'Form Submissions' };

export default function SubmissionsPage({ params }: { params: { formId: string } }): JSX.Element {
  return <SubmissionsLoader formId={params.formId} />;
}
