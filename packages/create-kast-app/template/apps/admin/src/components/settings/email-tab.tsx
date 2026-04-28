'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle, Save, Send, XCircle } from 'lucide-react';
import { useState, type JSX } from 'react';
import type { UseSettingsReturn } from './use-settings';

interface Props {
  s: UseSettingsReturn;
}

export function EmailTab({ s }: Props): JSX.Element {
  const [host, setHost] = useState<string>(() => String(s.getValue('smtp.host') ?? ''));
  const [port, setPort] = useState<string>(() => String(s.getValue('smtp.port') ?? '587'));
  const [user, setUser] = useState<string>(() => String(s.getValue('smtp.user') ?? ''));
  const [pass, setPass] = useState<string>('');
  const [from, setFrom] = useState<string>(() => String(s.getValue('smtp.from') ?? ''));
  const [fromName, setFromName] = useState<string>(() => String(s.getValue('smtp.fromName') ?? ''));
  const [testTo, setTestTo] = useState('');
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [testing, setTesting] = useState(false);

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
    <div className="space-y-6 max-w-lg">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="smtp-host">SMTP Host</Label>
          <Input
            id="smtp-host"
            value={host}
            onChange={(e) => setHost(e.target.value)}
            placeholder="smtp.example.com"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="smtp-port">Port</Label>
          <Input
            id="smtp-port"
            value={port}
            onChange={(e) => setPort(e.target.value)}
            placeholder="587"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="smtp-user">Username</Label>
        <Input
          id="smtp-user"
          value={user}
          onChange={(e) => setUser(e.target.value)}
          placeholder="user@example.com"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="smtp-pass">Password</Label>
        <Input
          id="smtp-pass"
          type="password"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          placeholder="Leave blank to keep existing"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="smtp-from">From Address</Label>
          <Input
            id="smtp-from"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            placeholder="noreply@example.com"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="smtp-from-name">From Name</Label>
          <Input
            id="smtp-from-name"
            value={fromName}
            onChange={(e) => setFromName(e.target.value)}
            placeholder="My CMS"
          />
        </div>
      </div>
      <Button
        onClick={() => {
          void save();
        }}
        disabled={s.saving}
        className="flex items-center gap-2"
      >
        <Save className="size-4" />
        {s.saving ? 'Saving…' : 'Save Email'}
      </Button>

      <div className="border-t pt-6 space-y-4">
        <p className="text-sm font-medium">Send Test Email</p>
        <div className="flex gap-2">
          <Input
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
            placeholder="recipient@example.com"
          />
          <Button
            variant="outline"
            onClick={() => {
              void sendTest();
            }}
            disabled={testing || !testTo}
            className="flex items-center gap-2 whitespace-nowrap bg-white text-gray-700 border-gray-300 hover:bg-gray-100 hover:text-gray-900"
          >
            <Send className="size-4" />
            {testing ? 'Sending…' : 'Send Test'}
          </Button>
        </div>
        {testResult === 'success' && (
          <p className="flex items-center gap-2 text-sm text-green-600">
            <CheckCircle className="size-4" /> Test email sent successfully
          </p>
        )}
        {testResult === 'error' && (
          <p className="flex items-center gap-2 text-sm text-destructive">
            <XCircle className="size-4" /> Failed to send test email — check your SMTP settings
          </p>
        )}
      </div>
    </div>
  );
}
