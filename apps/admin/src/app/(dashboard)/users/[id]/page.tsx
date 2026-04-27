import { EditUserPageClient } from '@/components/users/edit-user-page';
import type { Metadata } from 'next';
import type { JSX } from 'react';
interface Props {
  params: Promise<{ id: string }>;
}
export const metadata: Metadata = { title: 'Edit User' };
export default async function EditUserPage({ params }: Props): Promise<JSX.Element> {
  const { id } = await params;
  return <EditUserPageClient userId={id} />;
}
