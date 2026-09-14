'use client';
import { TwoFactorPrompt } from '@/components/auth/two-factor-prompt';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingBlock } from '@/components/ui/spinner';
import { API_URL } from '@/config/env';
import { persistSignIn } from '@/lib/complete-sign-in';
import { useSession } from '@/lib/session';
import type { TokenPair } from '@/types';
import type { LoginResult } from '@kast-cms/sdk';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, type JSX } from 'react';

export default function OAuthCallbackPage(): JSX.Element {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { setSession } = useSession();
  const started = useRef(false);
  const [challenge, setChallenge] = useState<string | null>(null);
  const finish = async (pair: TokenPair): Promise<void> => {
    await persistSignIn(pair);
    setSession(pair);
    router.replace('/content-types');
  };
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const code = searchParams.get('code');
    if (!code) {
      router.replace('/login');
      return;
    }
    // Remove the single-use code from browser history immediately.
    window.history.replaceState(null, '', window.location.pathname);
    void (async () => {
      try {
        const response = await fetch(`${API_URL}/api/v1/auth/oauth/exchange`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        });
        if (!response.ok) throw new Error('Sign in failed');
        const { data } = (await response.json()) as { data: LoginResult };
        if ('requiresTwoFactor' in data) {
          setChallenge(data.challengeToken);
          return;
        }
        await persistSignIn(data);
        setSession(data);
        router.replace('/content-types');
      } catch {
        router.replace('/login');
      }
    })();
  }, [searchParams, router, setSession]);
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Complete sign in</CardTitle>
        </CardHeader>
        <CardContent>
          {challenge ? (
            <TwoFactorPrompt
              challengeToken={challenge}
              onSuccess={finish}
              onCancel={() => router.replace('/login')}
            />
          ) : (
            <LoadingBlock label="Signing in…" />
          )}
        </CardContent>
      </Card>
    </main>
  );
}
