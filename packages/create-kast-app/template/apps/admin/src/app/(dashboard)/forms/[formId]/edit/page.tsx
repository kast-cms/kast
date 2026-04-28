import { FormBuilderLoader } from '@/components/forms/form-builder-loader';
import type { Metadata } from 'next';
import type { JSX } from 'react';

export const metadata: Metadata = { title: 'Edit Form' };

export default function EditFormPage({ params }: { params: { formId: string } }): JSX.Element {
  return <FormBuilderLoader formId={params.formId} />;
}
