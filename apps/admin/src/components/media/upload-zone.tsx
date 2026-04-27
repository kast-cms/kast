'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

  const areaClass = dragging
    ? 'border-[--color-primary] bg-[--color-primary]/5'
    : 'border-[--color-border]';

  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-12 transition-colors ${areaClass}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => {
        setDragging(false);
      }}
      onDrop={handleDrop}
    >
      <Upload className="h-10 w-10 text-[--color-muted-foreground]" />
      <div className="text-center">
        <p className="text-sm font-medium">{t('uploadZone.dropHere')}</p>
        <p className="text-xs text-[--color-muted-foreground]">{t('uploadZone.or')}</p>
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
        <p className="text-sm text-[--color-muted-foreground]">{t('uploadZone.uploading')}</p>
      )}
    </div>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-xl bg-[--color-background] shadow-xl">
        <div className="flex items-center justify-between border-b border-[--color-border] p-4">
          <h2 className="font-semibold">{t('uploadZone.title')}</h2>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onClose}
            disabled={uploading}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <Tabs defaultValue="file" className="p-4">
          <TabsList className="mb-4">
            <TabsTrigger value="file">
              <Upload className="me-2 h-4 w-4" />
              {t('uploadZone.tabFile')}
            </TabsTrigger>
            <TabsTrigger value="url">
              <LinkIcon className="me-2 h-4 w-4" />
              {t('uploadZone.tabUrl')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="file">
            <DropArea onUpload={onUpload} uploading={uploading} t={t} />
          </TabsContent>

          <TabsContent value="url">
            <div className="space-y-3">
              <p className="text-sm text-[--color-muted-foreground]">{t('uploadZone.urlHint')}</p>
              <div className="flex gap-2">
                <Input
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                  }}
                  placeholder="https://example.com/image.jpg"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleUrlUpload();
                  }}
                />
                <Button onClick={handleUrlUpload} disabled={uploading || !url.trim()}>
                  {t('uploadZone.import')}
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
