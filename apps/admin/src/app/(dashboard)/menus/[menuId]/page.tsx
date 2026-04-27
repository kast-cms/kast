import { MenuBuilderLoader } from '@/components/menus/menu-builder-loader';
import type { Metadata } from 'next';
import type { JSX } from 'react';

export const metadata: Metadata = { title: 'Edit Menu' };

interface Props {
  params: Promise<{ menuId: string }>;
}

export default async function EditMenuPage({ params }: Props): Promise<JSX.Element> {
  const { menuId } = await params;
  return <MenuBuilderLoader menuId={menuId} />;
}
