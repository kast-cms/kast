'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PlugZap } from 'lucide-react';
import { useState, type JSX } from 'react';
import { EnvManagedField } from './settings-field';
import type { UseSettingsReturn } from './use-settings';

interface Props {
  s: UseSettingsReturn;
}

interface ProbeResult {
  provider: string;
  status: string;
  warning?: string;
}

/**
 * Read-only by design. Storage provider, size cap and MIME allow-list are all
 * resolved from the environment at boot — the adapter is selected once during
 * DI and the upload limit is baked into multer's options — so a value edited
 * here could never take effect. The API refuses to store these keys and does
 * not return them, so the previous editable form saved nothing and reported
 * success. The connection test below is the part that was always real.
 */
export function StorageTab({ s }: Props): JSX.Element {
  const [testResult, setTestResult] = useState<ProbeResult | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  const runTest = async (): Promise<void> => {
    setTesting(true);
    setTestError(null);
    try {
      setTestResult((await s.testStorage()) as ProbeResult);
    } catch (err) {
      setTestResult(null);
      setTestError(err instanceof Error ? err.message : 'Storage test failed.');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Storage</CardTitle>
          <CardDescription>
            Where uploaded media is written, and what is accepted. These are read from the
            API&apos;s environment at startup and cannot be changed from the admin.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 pt-4">
          <EnvManagedField
            label="Storage Provider"
            envVar="STORAGE_PROVIDER"
            hint="local keeps files on the API server’s disk; s3 and r2 write to object storage. The adapter is chosen once when the API boots."
          />
          <EnvManagedField
            label="Max File Size"
            envVar="UPLOAD_MAX_FILE_SIZE_MB"
            hint="Applies to a single upload. The request is aborted at this size before the body is buffered."
          />
          <EnvManagedField
            label="Allowed MIME Types"
            envVar="UPLOAD_ALLOWED_MIME_TYPES"
            hint="Comma-separated. image/svg+xml is excluded by default: an SVG is a script-bearing document and nothing here sanitises one."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Connection</CardTitle>
          <CardDescription>
            Writes a probe object through the live adapter, reads it back, compares the bytes and
            deletes it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <Button
            variant="outline"
            onClick={() => {
              void runTest();
            }}
            loading={testing}
          >
            {!testing && <PlugZap />}
            {testing ? 'Testing…' : 'Test Connection'}
          </Button>

          {testResult !== null && (
            <Alert variant={testResult.warning === undefined ? 'success' : 'warning'}>
              <AlertTitle>{testResult.provider} reachable</AlertTitle>
              <AlertDescription>{testResult.warning ?? testResult.status}</AlertDescription>
            </Alert>
          )}

          {testError !== null && (
            <Alert variant="destructive">
              <AlertTitle>Storage test failed</AlertTitle>
              <AlertDescription>{testError}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
