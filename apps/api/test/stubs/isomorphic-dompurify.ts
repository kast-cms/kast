/**
 * E2E stub for `isomorphic-dompurify`. The real package pulls in jsdom /
 * @exodus/bytes which ship ESM-only files that ts-jest (CommonJS) cannot
 * transform, and booting the whole AppModule transitively imports it. For e2e
 * we only need rich-text sanitization to load and behave safely; this stub
 * strips the obvious dangerous constructs so persisted content is still clean.
 * It is mapped in via `moduleNameMapper` in jest-e2e.json — app source is
 * untouched.
 */
function sanitize(html: string): string {
  return String(html)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, '')
    .replace(/\s+on\w+="[^"]*"/gi, '')
    .replace(/\s+on\w+='[^']*'/gi, '')
    .replace(/javascript:/gi, '');
}

export default { sanitize };
export { sanitize };
