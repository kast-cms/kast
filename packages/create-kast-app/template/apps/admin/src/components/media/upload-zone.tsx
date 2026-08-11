'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { Link as LinkIcon, Upload, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRef, useState, type DragEvent, type JSX } from 'react';

interface UploadZoneProps {
  onUpload: (files: File[]) => void;
  onUploadUrl: (url: string) => void;
  onClose: () => void;
  uploading: boolean;
}

function DropArea({
  onUpload,
  uploading,
  t,
}: {
  onUpload: (files: File[]) => void;
  uploading: boolean;
  t: ReturnType<typeof useTranslations>;
}): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function handleDrop(e: DragEvent<HTMLDivElement>): void {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) onUpload(files);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>): void {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) onUpload(files);
  }

  return (
    <Card
      variant="dashed"
      className={cn(
        'flex flex-col items-center justify-center gap-3 px-6 py-10 text-center',
        'transition-[background-color,border-color] duration-150 ease-out-quad',
        // The drop target tints toward the brand on both hover and drag, so the
        // "you can let go here" state is the same colour story as the hover hint.
        dragging
          ? 'border-primary bg-primary-subtle'
          : 'bg-muted/40 hover:border-primary/60 hover:bg-primary-subtle/60',
      )}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => {
        setDragging(false);
      }}
      onDrop={handleDrop}
    >
      <div
        className={cn(
          'grid size-12 place-items-center rounded-xl transition-colors duration-150 ease-out-quad',
          dragging
            ? 'bg-primary text-primary-foreground'
            : 'bg-primary-subtle text-primary-subtle-foreground',
        )}
      >
        <Upload className="size-5" />
      </div>

      <div className="space-y-0.5">
        <p className="text-sm font-medium text-foreground">{t('uploadZone.dropHere')}</p>
        <p className="text-xs text-muted-foreground">{t('uploadZone.or')}</p>
      </div>

      <Button
        variant="outline"
        size="sm"
        disabled={uploading}
        onClick={() => {
          inputRef.current?.click();
        }}
      >
        {t('uploadZone.browse')}
      </Button>
      <input ref={inputRef} type="file" multiple className="hidden" onChange={handleFileInput} />

      {uploading && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner size="sm" label={null} />
          {t('uploadZone.uploading')}
        </p>
      )}
    </Card>
  );
}

export function UploadZone({
  onUpload,
  onUploadUrl,
  onClose,
  uploading,
}: UploadZoneProps): JSX.Element {
  const t = useTranslations('mediaLibrary');
  const [url, setUrl] = useState('');

  function handleUrlUpload(): void {
    if (!url.trim()) return;
    onUploadUrl(url.trim());
    setUrl('');
  }

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        // An upload in flight owns the dialog — same guard the close button has.
        if (!next && !uploading) onClose();
      }}
    >
      <DialogContent showCloseButton={false} className="gap-0 p-0">
        <DialogHeader className="flex-row items-center justify-between gap-2 border-b border-border py-3 ps-5 pe-3">
          <DialogTitle className="text-md">{t('uploadZone.title')}</DialogTitle>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Close"
            onClick={onClose}
            disabled={uploading}
          >
            <X />
          </Button>
        </DialogHeader>

        <Tabs defaultValue="file" className="px-5 pt-4 pb-5">
          <TabsList>
            <TabsTrigger value="file">
              <Upload />
              {t('uploadZone.tabFile')}
            </TabsTrigger>
            <TabsTrigger value="url">
              <LinkIcon />
              {t('uploadZone.tabUrl')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="file">
            <DropArea onUpload={onUpload} uploading={uploading} t={t} />
          </TabsContent>

          <TabsContent value="url">
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{t('uploadZone.urlHint')}</p>
              <div className="flex items-center gap-2">
                <Input
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                  }}
                  placeholder="https://example.com/image.jpg"
                  startAdornment={<LinkIcon />}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleUrlUpload();
                  }}
                />
                <Button
                  className="shrink-0"
                  onClick={handleUrlUpload}
                  disabled={!url.trim()}
                  loading={uploading}
                >
                  {t('uploadZone.import')}
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
