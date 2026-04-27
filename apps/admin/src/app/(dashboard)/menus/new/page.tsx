import { MenuBuilder } from '@/components/menus/menu-builder';
import type { Metadata } from 'next';
import type { JSX } from 'react';

export const metadata: Metadata = { title: 'New Menu' };

export default function NewMenuPage(): JSX.Element {
  return <MenuBuilder />;
}
