import { SessionProvider } from '@/lib/session';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import type { JSX, ReactNode } from 'react';

interface ProvidersProps {
  children: ReactNode;
}

export async function Providers({ children }: ProvidersProps): Promise<JSX.Element> {
  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      <SessionProvider>{children}</SessionProvider>
    </NextIntlClientProvider>
  );
}
