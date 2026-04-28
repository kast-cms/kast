import { FormBuilder } from '@/components/forms/form-builder';
import type { Metadata } from 'next';
import type { JSX } from 'react';

export const metadata: Metadata = { title: 'New Form' };

export default function NewFormPage(): JSX.Element {
  return <FormBuilder />;
}
