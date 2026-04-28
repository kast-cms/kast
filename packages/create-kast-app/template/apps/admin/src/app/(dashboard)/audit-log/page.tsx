import { AuditLogPage } from '@/components/audit/audit-log-page';
import type { Metadata } from 'next';
import type { JSX } from 'react';

export const metadata: Metadata = { title: 'Audit Log' };

export default function AuditLogRoutePage(): JSX.Element {
  return <AuditLogPage />;
}
