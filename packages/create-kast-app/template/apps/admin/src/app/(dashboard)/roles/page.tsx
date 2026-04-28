import { RolesPageClient } from '@/components/roles/roles-page';
import type { Metadata } from 'next';
import type { JSX } from 'react';
export const metadata: Metadata = { title: 'Roles' };
export default function RolesPage(): JSX.Element {
  return <RolesPageClient />;
}
