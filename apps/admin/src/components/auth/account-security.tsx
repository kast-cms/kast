'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { adminRoute } from '@/config/env';
import { createApiClient } from '@/lib/api';
import { useSession } from '@/lib/session';
import type { AuthSession, TwoFactorSetup, TwoFactorStatus } from '@kast-cms/sdk';
import { useCallback, useEffect, useState, type JSX } from 'react';

export function AccountSecurity(): JSX.Element {
  const { session, clearSession } = useSession();
  const [status, setStatus] = useState<TwoFactorStatus | null>(null);
  const [sessions, setSessions] = useState<AuthSession[]>([]);
  const [setup, setSetup] = useState<TwoFactorSetup | null>(null);
  const [codes, setCodes] = useState<string[]>([]);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const token = session?.accessToken;
  const refresh = useCallback(async (): Promise<void> => {
    if (!token) return;
    const auth = createApiClient(token).auth;
    const [factor, devices] = await Promise.all([auth.twoFactorStatus(), auth.sessions()]);
    setStatus(factor.data);
    setSessions(devices.data);
  }, [token]);
  useEffect(() => {
    void refresh().catch(() => setError('Could not load account security. Please sign in again.'));
  }, [refresh]);
  const action = async (work: () => Promise<void>): Promise<void> => {
    setBusy(true);
    setError('');
    try {
      await work();
      setCode('');
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not complete the request');
    } finally {
      setBusy(false);
    }
  };
  const auth = createApiClient(token).auth;
  const signOut = (): void => {
    clearSession();
    window.location.assign(adminRoute('/login'));
  };
  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Two-factor authentication</CardTitle>
          <CardDescription>
            {status?.enabled
              ? `Enabled · ${status.recoveryCodesRemaining} recovery codes remaining`
              : 'Add a code from an authenticator app to each sign-in, including SSO.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!status && !error && <p>Loading…</p>}
          {status && !status.enabled && !setup && (
            <Button
              disabled={busy}
              onClick={() =>
                void action(async () => {
                  setSetup((await auth.setupTwoFactor()).data);
                  setCodes([]);
                })
              }
            >
              Set up authenticator
            </Button>
          )}
          {setup && (
            <div className="space-y-3">
              <p className="text-sm">
                Scan this QR code with your authenticator app, or enter the setup key manually.
              </p>
              <img src={setup.qrCode} alt="Authenticator setup QR code" width={200} height={200} />
              <p className="break-all rounded border p-3 font-mono text-sm">{setup.secret}</p>
              <p className="text-sm text-muted-foreground">
                Enter the generated code below to enable protection. Your other devices will be
                signed out.
              </p>
            </div>
          )}
          {(setup || status?.enabled) && (
            <>
              <Label htmlFor="security-code">Authenticator or recovery code</Label>
              <Input
                id="security-code"
                autoComplete="one-time-code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                disabled={busy}
              />
              <div className="flex flex-wrap gap-2">
                {setup && (
                  <Button
                    disabled={busy || !code}
                    onClick={() =>
                      void action(async () => {
                        const result = await auth.enableTwoFactor(code.trim());
                        setCodes(result.data.recoveryCodes);
                        setSetup(null);
                      })
                    }
                  >
                    Enable two-factor authentication
                  </Button>
                )}
                {status?.enabled && (
                  <>
                    <Button
                      variant="outline"
                      disabled={busy || !code}
                      onClick={() =>
                        void action(async () => {
                          setCodes(
                            (await auth.regenerateRecoveryCodes(code.trim())).data.recoveryCodes,
                          );
                        })
                      }
                    >
                      Replace recovery codes
                    </Button>
                    <Button
                      variant="destructive"
                      disabled={busy || !code}
                      onClick={() =>
                        void action(async () => {
                          await auth.disableTwoFactor(code.trim());
                          setCodes([]);
                        })
                      }
                    >
                      Disable two-factor authentication
                    </Button>
                  </>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Each code can be used once. Wait for the next authenticator code after a successful
                action. Changing protection signs out your other devices.
              </p>
            </>
          )}
          {codes.length > 0 && (
            <div className="space-y-3 rounded border p-4">
              <h3 className="font-medium">Save your recovery codes now</h3>
              <p className="text-sm text-muted-foreground">
                Store these somewhere safe. Each code works once. These codes will not be shown
                again; any previous codes have been replaced.
              </p>
              <pre className="select-all text-sm">{codes.join('\n')}</pre>
              <Button variant="outline" onClick={() => setCodes([])}>
                I have saved my codes
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Active sessions</CardTitle>
          <CardDescription>
            Revoking a device immediately ends its access. Sessions expire 30 days after sign-in.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {sessions.map((device) => (
            <div key={device.id} className="flex items-start justify-between gap-4 border-b pb-4">
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {device.current ? 'This device' : 'Other device'}
                </p>
                <p className="break-words text-xs text-muted-foreground">
                  {device.userAgent || 'Browser details unavailable'}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {device.ipAddress || 'Unknown IP'} · Last active{' '}
                  {new Date(device.lastUsedAt ?? device.createdAt).toLocaleString()}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() =>
                  void action(async () => {
                    await auth.revokeSession(device.id);
                    if (device.current) signOut();
                  })
                }
              >
                Revoke
              </Button>
            </div>
          ))}
          {status && sessions.length === 0 && (
            <p className="text-sm text-muted-foreground">No active sessions.</p>
          )}
          <Button
            variant="destructive"
            disabled={busy || sessions.length === 0}
            onClick={() =>
              void action(async () => {
                await auth.revokeAllSessions();
                signOut();
              })
            }
          >
            Sign out all devices
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
