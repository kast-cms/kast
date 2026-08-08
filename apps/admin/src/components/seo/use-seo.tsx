'use client';

import { createApiClient } from '@/lib/api';
import { useSession } from '@/lib/session';
import type {
  CreateRedirectBody,
  KastClient,
  Redirect,
  SeoScore,
  UpdateRedirectBody,
} from '@kast-cms/sdk';
import { useCallback, useEffect, useState } from 'react';

/**
 * Result returned by the redirects CSV import endpoint
 * (`POST /api/v1/seo/redirects/import`).
 */
export interface RedirectImportResult {
  created: number;
  skipped: number;
  errors: number;
}

/**
 * Subset of the SEO resource for the CSV import/export endpoints that are
 * being added to the API/SDK in parallel. Once the SDK exposes
 * `importRedirects` / `exportRedirects` natively this assertion becomes a no-op.
 */
interface RedirectCsvResource {
  importRedirects: (file: File) => Promise<RedirectImportResult>;
  exportRedirects: () => Promise<Blob>;
}

function redirectCsv(client: KastClient): RedirectCsvResource {
  return client.seo as unknown as RedirectCsvResource;
}

export interface UseSeoReturn {
  redirects: Redirect[];
  redirectsLoading: boolean;
  sitemapUrls: Array<{ canonicalUrl: string; updatedAt: string }>;
  sitemapLoading: boolean;
  score: SeoScore | null;
  scoreLoading: boolean;
  createRedirect: (body: CreateRedirectBody) => Promise<void>;
  updateRedirect: (id: string, body: UpdateRedirectBody) => Promise<void>;
  deleteRedirect: (id: string) => Promise<void>;
  importRedirects: (file: File) => Promise<RedirectImportResult>;
  exportRedirects: () => Promise<Blob>;
  loadRedirects: () => Promise<void>;
  loadSitemap: () => Promise<void>;
  loadScore: (entryId: string) => Promise<void>;
  validateSeo: (entryId: string) => Promise<void>;
}

interface SitemapEntry {
  canonicalUrl: string;
  updatedAt: string;
}

interface SitemapListResponse {
  data: SitemapEntry[];
}

export function useSeo(): UseSeoReturn {
  const { session } = useSession();
  const client = createApiClient(session?.accessToken);

  const [redirects, setRedirects] = useState<Redirect[]>([]);
  const [redirectsLoading, setRedirectsLoading] = useState(false);
  const [sitemapUrls, setSitemapUrls] = useState<SitemapEntry[]>([]);
  const [sitemapLoading, setSitemapLoading] = useState(false);
  const [score, setScore] = useState<SeoScore | null>(null);
  const [scoreLoading, setScoreLoading] = useState(false);

  const loadRedirects = useCallback(async (): Promise<void> => {
    setRedirectsLoading(true);
    try {
      const res = await client.seo.listRedirects();
      setRedirects(res.data);
    } finally {
      setRedirectsLoading(false);
    }
  }, []);

  const loadSitemap = useCallback(async (): Promise<void> => {
    setSitemapLoading(true);
    try {
      const res: SitemapListResponse = await client.seo.listSitemapEntries();
      setSitemapUrls(Array.isArray(res.data) ? res.data : []);
    } finally {
      setSitemapLoading(false);
    }
  }, []);

  const loadScore = useCallback(async (entryId: string): Promise<void> => {
    setScoreLoading(true);
    try {
      const res = await client.seo.getScore(entryId);
      setScore(res.data);
    } catch {
      setScore(null);
    } finally {
      setScoreLoading(false);
    }
  }, []);

  const validateSeo = useCallback(async (entryId: string): Promise<void> => {
    await client.seo.validate(entryId);
  }, []);

  const createRedirect = useCallback(
    async (body: CreateRedirectBody): Promise<void> => {
      await client.seo.createRedirect(body);
      await loadRedirects();
    },
    [loadRedirects],
  );

  const updateRedirect = useCallback(
    async (id: string, body: UpdateRedirectBody): Promise<void> => {
      await client.seo.updateRedirect(id, body);
      await loadRedirects();
    },
    [loadRedirects],
  );

  const deleteRedirect = useCallback(
    async (id: string): Promise<void> => {
      await client.seo.deleteRedirect(id);
      await loadRedirects();
    },
    [loadRedirects],
  );

  const importRedirects = useCallback(
    async (file: File): Promise<RedirectImportResult> => {
      const result = await redirectCsv(client).importRedirects(file);
      await loadRedirects();
      return result;
    },
    [loadRedirects],
  );

  const exportRedirects = useCallback(async (): Promise<Blob> => {
    return redirectCsv(client).exportRedirects();
  }, []);

  useEffect(() => {
    void loadRedirects();
  }, [loadRedirects]);

  return {
    redirects,
    redirectsLoading,
    sitemapUrls,
    sitemapLoading,
    score,
    scoreLoading,
    createRedirect,
    updateRedirect,
    deleteRedirect,
    importRedirects,
    exportRedirects,
    loadRedirects,
    loadSitemap,
    loadScore,
    validateSeo,
  };
}
