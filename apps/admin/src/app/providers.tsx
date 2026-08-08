import { ThemeProvider } from '@/components/theme/theme-provider';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ToastContextProvider } from '@/components/ui/use-toast';
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
      <ThemeProvider>
        <SessionProvider>
          <TooltipProvider delayDuration={250} skipDelayDuration={400}>
            <ToastContextProvider>{children}</ToastContextProvider>
          </TooltipProvider>
        </SessionProvider>
      </ThemeProvider>
    </NextIntlClientProvider>
  );
}
