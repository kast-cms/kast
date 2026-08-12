'use client';

import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { LoadingBlock } from '@/components/ui/spinner';
import { API_URL } from '@/config/env';
import { useSession } from '@/lib/session';
import { ShieldAlert } from 'lucide-react';
import { useEffect, useRef, useState, type JSX } from 'react';

export function QueueMonitorPage(): JSX.Element {
  const { session, status } = useSession();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);

  useEffect(() => {
    if (status !== 'authenticated' || !session?.accessToken) return;
    const controller = new AbortController();
    void fetch(`${API_URL}/api/v1/queue-board/session`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.accessToken}` },
      credentials: 'include',
      signal: controller.signal,
    }).then((response) => {
      if (response.ok) setIframeUrl(`${API_URL}/api/bull-board/`);
    });
    return () => controller.abort();
  }, [status, session]);

  if (status === 'loading') {
    return <LoadingBlock />;
  }

  if (!iframeUrl) {
    return (
      <EmptyState
        Icon={ShieldAlert}
        title="Unauthorized"
        description="You do not have permission to view the queue monitor."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Queue Monitor" description="Inspect and manage background job queues" />
      {/* The embedded board owns its own chrome, so the card is just a frame:
          no padding, clipped corners, and a viewport-height canvas. */}
      <Card className="overflow-hidden p-0">
        <iframe
          ref={iframeRef}
          src={iframeUrl}
          title="Bull Board Queue Monitor"
          className="block h-[calc(100vh-16rem)] min-h-[32rem] w-full border-0 bg-card"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          referrerPolicy="no-referrer"
        />
      </Card>
    </div>
  );
}
