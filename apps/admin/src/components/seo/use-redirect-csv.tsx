'use client';

import { useToast } from '@/components/ui/use-toast';
import { useTranslations } from 'next-intl';
import { useCallback, useRef, useState, type ChangeEvent, type RefObject } from 'react';

interface ImportResult {
  created: number;
  skipped: number;
  errors: number;
}

interface UseRedirectCsvOptions {
  importRedirects: (file: File) => Promise<ImportResult>;
  exportRedirects: () => Promise<Blob>;
}

interface UseRedirectCsv {
  importing: boolean;
  exporting: boolean;
  /** Attach to the hidden `<input type="file">`. */
  fileInputRef: RefObject<HTMLInputElement | null>;
  /** Opens the OS file picker. */
  handleImportClick: () => void;
  handleFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  handleExport: () => void;
}

/**
 * CSV import/export for the redirects table.
 *
 * Pulled out of the page component because it is all imperative browser work —
 * a hidden file input, an object URL, a synthetic anchor click — and none of it
 * belongs in the middle of the table markup.
 */
export function useRedirectCsv({
  importRedirects,
  exportRedirects,
}: UseRedirectCsvOptions): UseRedirectCsv {
  const t = useTranslations('seo.redirects');
  const { toast } = useToast();
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const errorMessage = useCallback(
    (err: unknown): string => (err instanceof Error ? err.message : t('genericError')),
    [t],
  );

  const handleImportClick = useCallback((): void => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>): void => {
      const file = event.target.files?.[0];
      // Reset first, so picking the same file again still fires `change`.
      event.target.value = '';
      if (!file) return;

      void (async (): Promise<void> => {
        setImporting(true);
        try {
          const result = await importRedirects(file);
          toast({
            variant: 'success',
            title: t('importSuccessTitle'),
            description: t('importSuccessDescription', {
              created: result.created,
              skipped: result.skipped,
              errors: result.errors,
            }),
          });
        } catch (err) {
          toast({
            variant: 'destructive',
            title: t('importErrorTitle'),
            description: errorMessage(err),
          });
        } finally {
          setImporting(false);
        }
      })();
    },
    [importRedirects, toast, t, errorMessage],
  );

  const handleExport = useCallback((): void => {
    void (async (): Promise<void> => {
      setExporting(true);
      try {
        const blob = await exportRedirects();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'redirects.csv';
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      } catch (err) {
        toast({
          variant: 'destructive',
          title: t('exportErrorTitle'),
          description: errorMessage(err),
        });
      } finally {
        setExporting(false);
      }
    })();
  }, [exportRedirects, toast, t, errorMessage]);

  return {
    importing,
    exporting,
    fileInputRef,
    handleImportClick,
    handleFileChange,
    handleExport,
  };
}
