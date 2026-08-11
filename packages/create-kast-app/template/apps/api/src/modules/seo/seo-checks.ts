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

/**
 * Falling back to the site-wide title/description keeps the entry indexable, so
 * it is reported rather than treated as missing — but every entry sharing one
 * title is still worth flagging.
 */
export function checkSiteDefaults(usage: {
  titleFromSiteDefault: boolean;
  descriptionFromSiteDefault: boolean;
}): SeoIssueInput[] {
  const issues: SeoIssueInput[] = [];
  if (usage.titleFromSiteDefault) {
    issues.push({
      type: 'title_from_site_default',
      severity: 'INFO',
      message: 'Meta title falls back to the site default.',
      penalty: 5,
    });
  }
  if (usage.descriptionFromSiteDefault) {
    issues.push({
      type: 'desc_from_site_default',
      severity: 'INFO',
      message: 'Meta description falls back to the site default.',
      penalty: 3,
    });
  }
  return issues;
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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function extractText(node: ProsemirrorNode): string {
  if (node.text) return node.text;
  return (node.content ?? []).map(extractText).join(' ');
}

function hasH2(node: ProsemirrorNode): boolean {
  if (node.type === 'heading' && node.attrs?.level === 2) return true;
  return (node.content ?? []).some(hasH2);
}

/** RICH_TEXT is stored either as a ProseMirror document or as an HTML string. */
function documentText(doc: unknown): string {
  if (typeof doc === 'string') return doc.replace(/<[^>]*>/g, ' ');
  if (isPlainObject(doc)) return extractText(doc as unknown as ProsemirrorNode);
  return '';
}

function documentHasH2(doc: unknown): boolean {
  if (typeof doc === 'string') return /<h2[\s/>]/i.test(doc);
  if (isPlainObject(doc)) return hasH2(doc as unknown as ProsemirrorNode);
  return false;
}

function isPresentDocument(doc: unknown): boolean {
  if (typeof doc === 'string') return doc.trim() !== '';
  return isPlainObject(doc);
}

/**
 * Selects the values of a content type's RICH_TEXT fields out of one locale's
 * field map. Entry data is a map of every field, so the body checks have to be
 * pointed at the configured rich-text fields rather than at the map itself.
 */
export function selectBodyDocuments(
  fields: { name: string; type: string }[],
  data: unknown,
): { hasBodyField: boolean; documents: unknown[] } {
  const bodyFields = fields.filter((field) => field.type === 'RICH_TEXT');
  if (bodyFields.length === 0) return { hasBodyField: false, documents: [] };
  const map = isPlainObject(data) ? data : {};
  return {
    hasBodyField: true,
    documents: bodyFields
      .map((field) => (Object.hasOwn(map, field.name) ? map[field.name] : undefined))
      .filter(isPresentDocument),
  };
}

export function checkBody(bodyData: unknown): SeoIssueInput[] {
  return checkBodyDocuments(bodyData === null || bodyData === undefined ? [] : [bodyData]);
}

/** Scores every rich-text document of an entry as one body. */
export function checkBodyDocuments(documents: unknown[]): SeoIssueInput[] {
  const issues: SeoIssueInput[] = [];
  const present = documents.filter(isPresentDocument);
  if (present.length === 0) {
    issues.push({
      type: 'body_missing',
      severity: 'WARNING',
      message: 'Entry body is empty.',
      penalty: 10,
    });
    return issues;
  }
  const text = present.map(documentText).join(' ');
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  if (wordCount < BODY_MIN_WORDS) {
    issues.push({
      type: 'body_short',
      severity: 'WARNING',
      message: `Body has ${wordCount} words; at least ${BODY_MIN_WORDS} recommended.`,
      penalty: 10,
    });
  }
  if (!present.some(documentHasH2)) {
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
