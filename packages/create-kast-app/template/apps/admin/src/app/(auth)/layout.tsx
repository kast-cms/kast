import type { JSX, ReactNode } from 'react';

interface AuthLayoutProps {
  children: ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps): JSX.Element {
  return (
    <div className="grid min-h-screen place-items-center bg-[--color-background] p-4">
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
