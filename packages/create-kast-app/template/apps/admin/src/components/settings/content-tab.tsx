'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldHint } from '@/components/ui/label';
import { SeparatorWithLabel } from '@/components/ui/separator';
import type { JSX } from 'react';
import { EnvManagedField } from './settings-field';
import type { UseSettingsReturn } from './use-settings';

interface Props {
  s: UseSettingsReturn;
}

/**
 * Read-only by design.
 *
 * These four keys were writable but inert: nothing in the API ever read
 * `content.defaultStatus`, `content.versionRetention`, `media.imageQuality` or
 * `media.generateThumbnails`, so the form reported a successful save and changed
 * nothing. The API now withholds and rejects them rather than pretending, and
 * this tab states what the real behaviour is instead of offering a control that
 * would 400.
 */
export function ContentTab(_props: Props): JSX.Element {
  return (
    <div className="max-w-3xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Content</CardTitle>
          <CardDescription>
            How new entries and versions behave. None of this is configurable yet — it is shown so
            the behaviour is not a mystery.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 pt-4">
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Default content status</p>
            <div className="rounded-lg border border-border bg-muted/50 px-3 py-2">
              <p className="font-mono text-sm text-foreground">DRAFT</p>
              <p className="text-xs text-muted-foreground">Fixed by the content write gate.</p>
            </div>
            <FieldHint>
              A new entry always starts as a draft. Publishing is an explicit action that runs the
              schema and SEO gates.
            </FieldHint>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Version retention</p>
            <div className="rounded-lg border border-border bg-muted/50 px-3 py-2">
              <p className="font-mono text-sm text-foreground">Unlimited</p>
              <p className="text-xs text-muted-foreground">No pruning job exists.</p>
            </div>
            <FieldHint>
              Every save writes a numbered version and none are removed. Trash retention is separate
              and is fixed at 30 days.
            </FieldHint>
          </div>

          <SeparatorWithLabel>Media</SeparatorWithLabel>

          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Image quality</p>
            <div className="rounded-lg border border-border bg-muted/50 px-3 py-2">
              <p className="font-mono text-sm text-foreground">85 (WebP), 80 (thumbnails)</p>
              <p className="text-xs text-muted-foreground">
                Fixed in the media optimisation worker.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Thumbnails</p>
            <div className="rounded-lg border border-border bg-muted/50 px-3 py-2">
              <p className="font-mono text-sm text-foreground">Always on — 400px and 800px</p>
              <p className="text-xs text-muted-foreground">
                Generated for raster uploads only; vectors and documents are skipped.
              </p>
            </div>
          </div>

          <EnvManagedField
            label="Upload size limit"
            envVar="UPLOAD_MAX_FILE_SIZE_MB"
            hint="Shown here because it governs media too; change it on the Storage tab’s source."
          />
        </CardContent>
      </Card>
    </div>
  );
}
