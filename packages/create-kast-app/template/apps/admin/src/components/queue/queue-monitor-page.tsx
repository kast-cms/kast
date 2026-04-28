'use client';

import { Spinner } from '@/components/ui/spinner';
import { API_URL } from '@/config/env';
import { useSession } from '@/lib/session';
import { useEffect, useRef, useState, type JSX } from 'react';

export function QueueMonitorPage(): JSX.Element {
  const { session, status } = useSession();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);

  useEffect((): void => {
    if (status !== 'authenticated' || !session?.accessToken) return;
    const url = `${API_URL}/bull-board/?token=${encodeURIComponent(session.accessToken)}`;
    setIframeUrl(url);
  }, [status, session]);

  if (status === 'loading') {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!iframeUrl) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-[--color-muted-foreground]">
        Unauthorized
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-[--color-border] px-6 py-4">
        <div>
          <h1 className="text-xl font-semibold text-[--color-foreground]">Queue Monitor</h1>
          <p className="mt-0.5 text-sm text-[--color-muted-foreground]">
            Inspect and manage background job queues
          </p>
        </div>
      </div>
      <div className="relative flex-1">
        <iframe
          ref={iframeRef}
          src={iframeUrl}
          title="Bull Board Queue Monitor"
          className="absolute inset-0 h-full w-full border-0"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
      </div>
    </div>
  );
}
