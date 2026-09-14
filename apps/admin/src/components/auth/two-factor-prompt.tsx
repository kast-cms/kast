'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createApiClient } from '@/lib/api';
import type { TokenPair } from '@/types';
import { useState, type JSX } from 'react';

export function TwoFactorPrompt({
  challengeToken,
  onSuccess,
  onCancel,
}: {
  challengeToken: string;
  onSuccess: (pair: TokenPair) => Promise<void>;
  onCancel: () => void;
}): JSX.Element {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    setBusy(true);
    try {
      const { data } = await createApiClient().auth.verifyTwoFactor(challengeToken, code.trim());
      await onSuccess(data);
    } catch {
      setError('The code was invalid, already used, or expired. Return to sign in and try again.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Enter a code from your authenticator app or one of your recovery codes.
      </p>
      <Label htmlFor="two-factor-code">Authentication code</Label>
      <Input
        id="two-factor-code"
        autoComplete="one-time-code"
        autoFocus
        value={code}
        onChange={(event) => setCode(event.target.value)}
        required
        disabled={busy || Boolean(error)}
      />
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" className="w-full" loading={busy} disabled={Boolean(error)}>
        Verify and sign in
      </Button>
      <Button type="button" variant="ghost" className="w-full" onClick={onCancel} disabled={busy}>
        Return to sign in
      </Button>
    </form>
  );
}
