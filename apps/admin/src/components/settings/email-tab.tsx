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
import { AtSign, Mail, Save, Send } from 'lucide-react';
import { useState, type JSX } from 'react';
import { SettingsField } from './settings-field';
import type { UseSettingsReturn } from './use-settings';

interface Props {
  s: UseSettingsReturn;
}

/** Verification panel — deliberately separate from the form it verifies. */
function TestEmailCard({ s }: Props): JSX.Element {
  const [testTo, setTestTo] = useState('');
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [testing, setTesting] = useState(false);

  const sendTest = async (): Promise<void> => {
    setTesting(true);
    setTestResult(null);
    try {
      await s.testSmtp(testTo);
      setTestResult('success');
    } catch {
      setTestResult('error');
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Send Test Email</CardTitle>
        <CardDescription>
          Delivers a message using the settings that are currently saved.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
            placeholder="recipient@example.com"
            aria-label="Test recipient"
            startAdornment={<Mail />}
          />
          <Button
            variant="outline"
            onClick={() => {
              void sendTest();
            }}
            disabled={!testTo}
            loading={testing}
            className="shrink-0"
          >
            {!testing && <Send />}
            {testing ? 'Sending…' : 'Send Test'}
          </Button>
        </div>

        {testResult === 'success' && (
          <Alert variant="success">
            <AlertTitle>Test email sent successfully</AlertTitle>
            <AlertDescription>Check the inbox for {testTo}.</AlertDescription>
          </Alert>
        )}
        {testResult === 'error' && (
          <Alert variant="destructive">
            <AlertTitle>Failed to send test email</AlertTitle>
            <AlertDescription>
              Check your SMTP host, port and credentials, then save before retrying.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

export function EmailTab({ s }: Props): JSX.Element {
  const [host, setHost] = useState<string>(() => String(s.getValue('smtp.host') ?? ''));
  const [port, setPort] = useState<string>(() => String(s.getValue('smtp.port') ?? '587'));
  const [user, setUser] = useState<string>(() => String(s.getValue('smtp.user') ?? ''));
  const [pass, setPass] = useState<string>('');
  const [from, setFrom] = useState<string>(() => String(s.getValue('smtp.from') ?? ''));
  const [fromName, setFromName] = useState<string>(() => String(s.getValue('smtp.fromName') ?? ''));

  const save = async (): Promise<void> => {
    const patches = [
      { key: 'smtp.host', value: host },
      { key: 'smtp.port', value: port },
      { key: 'smtp.user', value: user },
      { key: 'smtp.from', value: from },
      { key: 'smtp.fromName', value: fromName },
    ];
    if (pass) patches.push({ key: 'smtp.password', value: pass });
    await s.patchSettings(patches);
  };

  return (
    <div className="max-w-3xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>SMTP</CardTitle>
          <CardDescription>
            The relay used for password resets, invitations and notifications.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 pt-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <SettingsField
              className="sm:col-span-2"
              label="SMTP Host"
              htmlFor="smtp-host"
              required
              hint="Hostname of your mail relay."
            >
              <Input
                id="smtp-host"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="smtp.example.com"
              />
            </SettingsField>

            <SettingsField label="Port" htmlFor="smtp-port" required hint="587 for STARTTLS.">
              <Input
                id="smtp-port"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                placeholder="587"
              />
            </SettingsField>
          </div>

          <SettingsField label="Username" htmlFor="smtp-user">
            <Input
              id="smtp-user"
              value={user}
              onChange={(e) => setUser(e.target.value)}
              placeholder="user@example.com"
            />
          </SettingsField>

          <SettingsField
            label="Password"
            htmlFor="smtp-pass"
            hint="Write-only — the stored value is never sent back to this screen."
          >
            <Input
              id="smtp-pass"
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder="Leave blank to keep existing"
            />
          </SettingsField>

          <SeparatorWithLabel>Sender</SeparatorWithLabel>

          <div className="grid gap-4 sm:grid-cols-2">
            <SettingsField label="From Address" htmlFor="smtp-from" required>
              <Input
                id="smtp-from"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                placeholder="noreply@example.com"
                startAdornment={<AtSign />}
              />
            </SettingsField>

            <SettingsField label="From Name" htmlFor="smtp-from-name">
              <Input
                id="smtp-from-name"
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                placeholder="My CMS"
              />
            </SettingsField>
          </div>
        </CardContent>
        <CardFooter className="justify-end">
          <Button
            onClick={() => {
              void save();
            }}
            loading={s.saving}
          >
            {!s.saving && <Save />}
            {s.saving ? 'Saving…' : 'Save Email'}
          </Button>
        </CardFooter>
      </Card>

      <TestEmailCard s={s} />
    </div>
  );
}
