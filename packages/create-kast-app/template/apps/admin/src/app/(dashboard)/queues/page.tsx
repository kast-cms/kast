import { QueueMonitorPage } from '@/components/queue/queue-monitor-page';
import type { Metadata } from 'next';
import type { JSX } from 'react';

export const metadata: Metadata = { title: 'Queue Monitor' };

export default function QueuesRoutePage(): JSX.Element {
  return <QueueMonitorPage />;
}
