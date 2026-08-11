import { KastLogo } from '@/components/layout/kast-logo';
import type { JSX, ReactNode } from 'react';

interface AuthLayoutProps {
  children: ReactNode;
}

/**
 * Shell for the unauthenticated screens.
 *
 * A single centred column on a softly top-lit ground, with the mark above the
 * card so the product identifies itself before the form asks for anything.
 */
export default function AuthLayout({ children }: AuthLayoutProps): JSX.Element {
  return (
    <div className="surface-gradient flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <div className="flex w-full max-w-sm flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-2.5">
          <KastLogo className="size-10" />
          <span className="text-2xs font-medium tracking-[0.2em] text-muted-foreground uppercase">
            Kast CMS
          </span>
        </div>
        <div className="w-full">{children}</div>
      </div>
    </div>
  );
}
