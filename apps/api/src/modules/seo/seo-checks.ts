import type { SeoIssueInput } from './seo.repository';

const TITLE_MIN = 30;
const TITLE_MAX = 60;
const DESC_MIN = 50;
const DESC_MAX = 160;
const BODY_MIN_WORDS = 300;
const SLUG_SAFE = /^[a-z0-9-]+$/;

export function checkTitle(metaTitle: string | null | undefined): SeoIssueInput[] {
  if (!metaTitle) {
    return [
      { type: 'title_missing', severity: 'ERROR', message: 'Meta title is missing.', penalty: 20 },
    ];
  }
  if (metaTitle.length < TITLE_MIN || metaTitle.length > TITLE_MAX) {
    return [
      {
        type: 'title_length',
        severity: 'WARNING',
        message: `Meta title should be ${TITLE_MIN}–${TITLE_MAX} characters (currently ${metaTitle.length}).`,
        penalty: 10,
      },
    ];
  }
  return [];
}

export function checkDescription(metaDescription: string | null | undefined): SeoIssueInput[] {
  if (!metaDescription) {
    return [
      {
        type: 'desc_missing',
        severity: 'WARNING',
        message: 'Meta description is missing.',
        penalty: 15,
      },
    ];
  }
  if (metaDescription.length < DESC_MIN || metaDescription.length > DESC_MAX) {
    return [
      {
        type: 'desc_length',
        severity: 'WARNING',
        message: `Meta description should be ${DESC_MIN}–${DESC_MAX} characters (currently ${metaDescription.length}).`,
        penalty: 8,
      },
    ];
  }
  return [];
}

export function checkOgImage(ogImageId: string | null | undefined): SeoIssueInput[] {
  if (!ogImageId) {
    return [
      {
        type: 'og_image_missing',
        severity: 'WARNING',
        message: 'OG image is not set.',
        penalty: 8,
      },
    ];
  }
  return [];
}

export function checkCanonical(canonicalUrl: string | null | undefined): SeoIssueInput[] {
  if (!canonicalUrl) {
    return [
      {
        type: 'canonical_missing',
        severity: 'WARNING',
        message: 'Canonical URL is not set.',
        penalty: 8,
      },
    ];
  }
  return [];
}

export function checkSlug(slug: string | undefined): SeoIssueInput[] {
  if (!slug || !SLUG_SAFE.test(slug)) {
    return [
      {
        type: 'slug_invalid',
        severity: 'ERROR',
        message: 'Slug contains uppercase or special characters.',
        penalty: 10,
      },
    ];
  }
  return [];
}

interface ProsemirrorNode {
  type: string;
  content?: ProsemirrorNode[];
  text?: string;
  attrs?: { level?: number };
}

function extractText(node: ProsemirrorNode): string {
  if (node.text) return node.text;
  return (node.content ?? []).map(extractText).join(' ');
}

function hasH2(node: ProsemirrorNode): boolean {
  if (node.type === 'heading' && node.attrs?.level === 2) return true;
  return (node.content ?? []).some(hasH2);
}

export function checkBody(bodyData: unknown): SeoIssueInput[] {
  const issues: SeoIssueInput[] = [];
  const node = bodyData as ProsemirrorNode | null | undefined;
  if (!node) {
    issues.push({
      type: 'body_missing',
      severity: 'WARNING',
      message: 'Entry body is empty.',
      penalty: 10,
    });
    return issues;
  }
  const text = extractText(node);
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  if (wordCount < BODY_MIN_WORDS) {
    issues.push({
      type: 'body_short',
      severity: 'WARNING',
      message: `Body has ${wordCount} words; at least ${BODY_MIN_WORDS} recommended.`,
      penalty: 10,
    });
  }
  if (!hasH2(node)) {
    issues.push({
      type: 'body_no_h2',
      severity: 'INFO',
      message: 'Body has no H2 heading.',
      penalty: 5,
    });
  }
  return issues;
}

export function computeScore(issues: SeoIssueInput[]): number {
  const total = issues.reduce((acc, i) => acc + i.penalty, 0);
  return Math.max(0, 100 - total);
}
