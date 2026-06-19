import { SubmissionsLoader } from '@/components/forms/submissions-loader';
import type { Metadata } from 'next';
import type { JSX } from 'react';

export const metadata: Metadata = { title: 'Form Submissions' };

interface SubmissionsPageProps {
  params: Promise<{ formId: string }>;
}

export default async function SubmissionsPage({
  params,
}: SubmissionsPageProps): Promise<JSX.Element> {
  const { formId } = await params;
  return <SubmissionsLoader formId={formId} />;
}
