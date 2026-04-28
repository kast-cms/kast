import { SettingsPage } from '@/components/settings/settings-page';
import type { Metadata } from 'next';
import type { JSX } from 'react';

export const metadata: Metadata = { title: 'Settings' };

export default function SettingsRoutePage(): JSX.Element {
  return <SettingsPage />;
}
