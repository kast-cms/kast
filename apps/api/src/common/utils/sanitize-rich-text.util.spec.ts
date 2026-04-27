// Mock isomorphic-dompurify to avoid ESM-only transitive deps (jsdom chain)
// The mock replicates the key XSS behaviours DOMPurify enforces so tests
// remain meaningful without requiring a real browser environment in Jest.
jest.mock('isomorphic-dompurify', () => {
  const sanitize = (html: string): string => {
    return html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, '')
      .replace(/<(object|embed|form|input)\b[^>]*>/gi, '')
      .replace(/\s+on\w+="[^"]*"/gi, '')
      .replace(/\s+on\w+='[^']*'/gi, '')
      .replace(/href="javascript:[^"]*"/gi, 'href=""')
      .replace(/\s+onerror="[^"]*"/gi, '');
  };
  return { default: { sanitize }, sanitize };
});

import { sanitizeRichText, sanitizeRichTextFields } from './sanitize-rich-text.util';

describe('sanitizeRichText', () => {
  it('strips <script> tags and content (XSS payload)', () => {
    const input = '<p>Hello</p><script>alert(1)</script>';
    const result = sanitizeRichText(input);
    expect(result).not.toContain('<script>');
    expect(result).not.toContain('alert(1)');
    expect(result).toContain('<p>Hello</p>');
  });

  it('strips inline event handlers', () => {
    const input = '<p onclick="alert(1)">Click me</p>';
    const result = sanitizeRichText(input);
    expect(result).not.toContain('onclick');
    expect(result).not.toContain('alert(1)');
    expect(result).toContain('<p>Click me</p>');
  });

  it('strips javascript: href links', () => {
    const input = '<a href="javascript:alert(1)">Click</a>';
    const result = sanitizeRichText(input);
    expect(result).not.toContain('javascript:');
  });

  it('strips onerror attributes from img tags', () => {
    const input = '<img src="x" onerror="alert(1)" />';
    const result = sanitizeRichText(input);
    expect(result).not.toContain('onerror');
  });

  it('strips iframe tags', () => {
    const input = '<iframe src="https://evil.com"></iframe>';
    const result = sanitizeRichText(input);
    expect(result).not.toContain('<iframe');
  });

  it('strips style tags', () => {
    const input = '<style>body { display: none }</style><p>Content</p>';
    const result = sanitizeRichText(input);
    expect(result).not.toContain('<style>');
    expect(result).toContain('<p>Content</p>');
  });

  it('preserves safe formatting markup', () => {
    const input =
      '<h2>Title</h2><p><strong>Bold</strong> and <em>italic</em></p><ul><li>Item</li></ul>';
    const result = sanitizeRichText(input);
    expect(result).toContain('<h2>Title</h2>');
    expect(result).toContain('<strong>Bold</strong>');
    expect(result).toContain('<em>italic</em>');
    expect(result).toContain('<li>Item</li>');
  });

  it('preserves safe anchor tags with allowed attributes', () => {
    const input = '<a href="https://example.com" rel="noopener" target="_blank">Link</a>';
    const result = sanitizeRichText(input);
    expect(result).toContain('href="https://example.com"');
    expect(result).toContain('<a ');
  });

  it('returns empty string for empty input', () => {
    expect(sanitizeRichText('')).toBe('');
  });
});

describe('sanitizeRichTextFields', () => {
  it('sanitizes only the fields listed as rich text', () => {
    const data = {
      title: '<script>alert(1)</script>Title',
      body: '<p>Content</p><script>evil()</script>',
      summary: '<script>xss()</script>',
    };
    const result = sanitizeRichTextFields(data, ['body']);
    // title and summary are NOT rich text — must be unchanged
    expect(result['title']).toBe('<script>alert(1)</script>Title');
    expect(result['summary']).toBe('<script>xss()</script>');
    // body IS rich text — must be sanitized
    expect(result['body']).not.toContain('<script>');
    expect(result['body']).toContain('<p>Content</p>');
  });

  it('returns data unchanged when no rich text fields are provided', () => {
    const data = { title: 'Hello', count: 5 };
    const result = sanitizeRichTextFields(data, []);
    expect(result).toEqual(data);
  });

  it('skips non-string field values', () => {
    const data = { body: 42 };
    const result = sanitizeRichTextFields(data, ['body']);
    expect(result['body']).toBe(42);
  });
});
