import DOMPurify from 'isomorphic-dompurify';

/**
 * OWASP A03 – Injection: sanitize HTML from rich text fields before storage.
 *
 * Strips all script tags, event handlers, and other XSS vectors while preserving
 * safe formatting markup. Uses isomorphic-dompurify so it runs in Node.js (JSDOM)
 * and in browser environments.
 */
export function sanitizeRichText(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'p',
      'br',
      'strong',
      'em',
      'u',
      's',
      'del',
      'ins',
      'mark',
      'sup',
      'sub',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'ul',
      'ol',
      'li',
      'a',
      'blockquote',
      'code',
      'pre',
      'img',
      'figure',
      'figcaption',
      'hr',
      'table',
      'thead',
      'tbody',
      'tr',
      'th',
      'td',
    ],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'target', 'rel', 'class', 'width', 'height'],
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input'],
    FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover', 'onfocus'],
  });
}

/**
 * Sanitizes all RICH_TEXT field values in a generic content data object.
 * Only modifies keys whose names appear in `richTextFieldNames`.
 */
export function sanitizeRichTextFields(
  data: Record<string, unknown>,
  richTextFieldNames: string[],
): Record<string, unknown> {
  if (richTextFieldNames.length === 0) return data;
  const result: Record<string, unknown> = { ...data };
  for (const name of richTextFieldNames) {
    if (typeof result[name] === 'string') {
      result[name] = sanitizeRichText(result[name] as string);
    }
  }
  return result;
}
