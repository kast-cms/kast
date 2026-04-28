export type IssueSeverity = 'ERROR' | 'WARNING' | 'INFO';
export type RedirectType = 'PERMANENT' | 'TEMPORARY';

export interface SeoMeta {
  id: string;
  entryId: string;
  metaTitle: string | null;
  metaDescription: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImageId: string | null;
  twitterTitle: string | null;
  twitterDesc: string | null;
  twitterImageId: string | null;
  canonicalUrl: string | null;
  noIndex: boolean;
  noFollow: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SeoIssue {
  id: string;
  type: string;
  severity: IssueSeverity;
  message: string;
  penalty: number;
}

export interface SeoScore {
  id: string;
  seoMetaId: string;
  score: number;
  validatedAt: string;
  issues: SeoIssue[];
}

export interface Redirect {
  id: string;
  fromPath: string;
  toPath: string;
  type: RedirectType;
  isActive: boolean;
  hitCount: number;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertSeoMetaBody {
  metaTitle?: string;
  metaDescription?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImageId?: string;
  twitterTitle?: string;
  twitterDesc?: string;
  twitterImageId?: string;
  canonicalUrl?: string;
  noIndex?: boolean;
  noFollow?: boolean;
}

export interface CreateRedirectBody {
  fromPath: string;
  toPath: string;
  type?: RedirectType;
}

export interface UpdateRedirectBody {
  fromPath?: string;
  toPath?: string;
  type?: RedirectType;
  isActive?: boolean;
}
