import { UsersPageClient } from '@/components/users/users-page';
import type { Metadata } from 'next';
import type { JSX } from 'react';
export const metadata: Metadata = { title: 'Users' };
export default function UsersPage(): JSX.Element {
  return <UsersPageClient />;
}
