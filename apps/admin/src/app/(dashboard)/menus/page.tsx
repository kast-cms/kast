import { MenusListClient } from '@/components/menus/menus-list';
import type { Metadata } from 'next';
import type { JSX } from 'react';

export const metadata: Metadata = { title: 'Menus' };

export default function MenusPage(): JSX.Element {
  return <MenusListClient />;
}
