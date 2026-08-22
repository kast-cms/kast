'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { SeparatorWithLabel } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { useApiClient } from '@/lib/session';
import type { MfaSetup, MfaStatus, SessionSummary } from '@kast-cms/sdk';
import { KeyRound, Save, ShieldCheck, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState, type JSX } from 'react';
import { EnvManagedField, SettingsField } from './settings-field';
import type { UseSettingsReturn } from './use-settings';

interface Props {
  s: UseSettingsReturn;
}

export function SecurityTab({ s }: Props): JSX.Element {
  const client = useApiClient();
  const { toast } = useToast();
  const [robotsTxt, setRobotsTxt] = useState<string>(() =>
    String(s.getValue('robots.txt') ?? 'User-agent: *\nAllow: /'),
  );
  const [mfa, setMfa] = useState<MfaStatus | null>(null);
  const [setup, setSetup] = useState<MfaSetup | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [verificationCode, setVerificationCode] = useState('');
  const [disablePassword, setDisablePassword] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [securityBusy, setSecurityBusy] = useState(false);

  const loadSecurity = useCallback(async (): Promise<void> => {
    const [mfaRes, sessionsRes] = await Promise.all([
      client.auth.mfaStatus(),
      client.auth.listSessions(),
    ]);
    setMfa(mfaRes.data);
    setSessions(sessionsRes.data);
  }, [client]);

  useEffect(() => {
    void loadSecurity();
  }, [loadSecurity]);

  const save = async (): Promise<void> => {
    await s.patchSettings([{ key: 'robots.txt', value: robotsTxt }]);
  };

  async function runSecurityAction(action: () => Promise<void>, success: string): Promise<void> {
    setSecurityBusy(true);
    try {
      await action();
      toast({ title: success });
    } finally {
      setSecurityBusy(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Multi-factor authentication</CardTitle>
          <CardDescription>
            Require a one-time authenticator code after password or SSO login.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 pt-4">
          <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
            <div>
              <p className="font-medium">{mfa?.enabled ? 'MFA enabled' : 'MFA disabled'}</p>
              <p className="text-sm text-muted-foreground">
                {mfa?.enabledAt
                  ? `Enabled ${new Date(mfa.enabledAt).toLocaleString()}`
                  : 'Protect this admin account with TOTP.'}
              </p>
            </div>
            <ShieldCheck className={mfa?.enabled ? 'text-success' : 'text-muted-foreground'} />
          </div>

          {!mfa?.enabled && (
            <div className="space-y-3">
              <Button
                type="button"
                variant="outline"
                disabled={securityBusy}
                onClick={() => {
                  void runSecurityAction(async () => {
                    const res = await client.auth.beginMfaSetup();
                    setSetup(res.data);
                  }, 'MFA setup started');
                }}
              >
                <KeyRound />
                Start MFA setup
              </Button>
              {setup && (
                <div className="space-y-3 rounded-lg border border-border p-4">
                  <SettingsField
                    label="Authenticator URI"
                    htmlFor="mfa-uri"
                    hint="Scan this URI with an authenticator app, then enter the six-digit code."
                  >
                    <Textarea id="mfa-uri" value={setup.otpauthUrl} readOnly rows={3} />
                  </SettingsField>
                  <SettingsField label="Verification code" htmlFor="mfa-code">
                    <Input
                      id="mfa-code"
                      inputMode="numeric"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value)}
                    />
                  </SettingsField>
                  <Button
                    type="button"
                    disabled={securityBusy || verificationCode.trim() === ''}
                    onClick={() => {
                      void runSecurityAction(async () => {
                        const res = await client.auth.verifyMfaSetup(
                          setup.secret,
                          verificationCode,
                        );
                        setRecoveryCodes(res.data.recoveryCodes);
                        setSetup(null);
                        setVerificationCode('');
                        await loadSecurity();
                      }, 'MFA enabled');
                    }}
                  >
                    Verify and enable
                  </Button>
                </div>
              )}
            </div>
          )}

          {mfa?.enabled && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3 rounded-lg border border-border p-4">
                <SettingsField label="Current password" htmlFor="mfa-disable-password">
                  <Input
                    id="mfa-disable-password"
                    type="password"
                    value={disablePassword}
                    onChange={(e) => setDisablePassword(e.target.value)}
                  />
                </SettingsField>
                <SettingsField label="MFA code" htmlFor="mfa-disable-code">
                  <Input
                    id="mfa-disable-code"
                    inputMode="numeric"
                    value={disableCode}
                    onChange={(e) => setDisableCode(e.target.value)}
                  />
                </SettingsField>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={securityBusy || disablePassword === '' || disableCode === ''}
                  onClick={() => {
                    void runSecurityAction(async () => {
                      const res = await client.auth.disableMfa(disablePassword, disableCode);
                      setMfa(res.data);
                      setDisablePassword('');
                      setDisableCode('');
                    }, 'MFA disabled');
                  }}
                >
                  Disable MFA
                </Button>
              </div>
              <div className="space-y-3 rounded-lg border border-border p-4">
                <SettingsField
                  label="Regenerate recovery codes"
                  htmlFor="mfa-recovery-code"
                  hint={`Unused recovery codes: ${mfa.recoveryCodeCount}`}
                >
                  <Input
                    id="mfa-recovery-code"
                    inputMode="numeric"
                    value={recoveryCode}
                    onChange={(e) => setRecoveryCode(e.target.value)}
                  />
                </SettingsField>
                <Button
                  type="button"
                  variant="outline"
                  disabled={securityBusy || recoveryCode === ''}
                  onClick={() => {
                    void runSecurityAction(async () => {
                      const res = await client.auth.regenerateRecoveryCodes(recoveryCode);
                      setRecoveryCodes(res.data.recoveryCodes);
                      setRecoveryCode('');
                      await loadSecurity();
                    }, 'Recovery codes regenerated');
                  }}
                >
                  Regenerate codes
                </Button>
              </div>
            </div>
          )}

          {recoveryCodes.length > 0 && (
            <Alert variant="warning">
              <AlertTitle>Save these recovery codes now</AlertTitle>
              <AlertDescription>
                <pre className="mt-2 rounded-md bg-muted p-3 font-mono text-xs">
                  {recoveryCodes.join('\n')}
                </pre>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Active sessions</CardTitle>
          <CardDescription>
            Review and revoke refresh-token sessions for this account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 pt-4">
          {sessions.map((session) => (
            <div
              key={session.id}
              className="flex items-center gap-3 rounded-lg border border-border px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {session.userAgent ?? 'Unknown device'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {session.ipAddress ?? 'Unknown IP'} · expires{' '}
                  {new Date(session.expiresAt).toLocaleString()}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={securityBusy}
                aria-label="Revoke session"
                onClick={() => {
                  void runSecurityAction(async () => {
                    await client.auth.revokeSession(session.id);
                    await loadSecurity();
                  }, 'Session revoked');
                }}
              >
                <Trash2 />
              </Button>
            </div>
          ))}
          {sessions.length === 0 && (
            <p className="text-sm text-muted-foreground">No active sessions.</p>
          )}
          {sessions.length > 1 && (
            <Button
              type="button"
              variant="outline"
              disabled={securityBusy}
              onClick={() => {
                void runSecurityAction(async () => {
                  await client.auth.revokeAllSessions();
                  await loadSecurity();
                }, 'Other sessions revoked');
              }}
            >
              Revoke all sessions
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Access</CardTitle>
          <CardDescription>
            Which browsers may call the API, and what crawlers are told about the site.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 pt-4">
          {/* CORS is applied once at bootstrap from the environment, so a value
              stored here could never take effect; the API rejects the write. */}
          <EnvManagedField
            label="Allowed CORS Origins"
            envVar="CORS_ORIGINS"
            hint="Comma-separated origins, applied when the API starts. '*' allows any origin."
          />

          <SeparatorWithLabel>Crawlers</SeparatorWithLabel>

          <SettingsField
            label="robots.txt content"
            htmlFor="robots-txt"
            hint="Served verbatim. Standard robots.txt directives, one per line."
          >
            <Textarea
              id="robots-txt"
              rows={6}
              value={robotsTxt}
              onChange={(e) => setRobotsTxt(e.target.value)}
              className="font-mono text-sm"
            />
          </SettingsField>
        </CardContent>
        <CardFooter className="justify-end">
          <Button
            onClick={() => {
              void save();
            }}
            loading={s.saving}
          >
            {!s.saving && <Save />}
            {s.saving ? 'Saving…' : 'Save Security'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
