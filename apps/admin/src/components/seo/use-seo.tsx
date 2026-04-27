'use client';

import { createApiClient } from '@/lib/api';
import { useSession } from '@/lib/session';
import type { CreateRedirectBody, Redirect, SeoScore, UpdateRedirectBody } from '@kast-cms/sdk';
import { useCallback, useEffect, useState } from 'react';

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
      const res = (await client.seo.getSitemap()) as unknown as SitemapListResponse;
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
    loadRedirects,
    loadSitemap,
    loadScore,
    validateSeo,
  };
}
