import { checkBody, checkBodyDocuments, selectBodyDocuments } from './seo-checks';

const paragraph = (words: number): unknown => ({
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: Array.from({ length: words }, (_, i) => ({
        type: 'text',
        text: `word${String(i)}`,
      })),
    },
  ],
});

describe('selectBodyDocuments', () => {
  const fields = [
    { name: 'title', type: 'TEXT' },
    { name: 'body', type: 'RICH_TEXT' },
    { name: 'notes', type: 'RICH_TEXT' },
  ];

  it('picks only the rich-text fields out of the locale field map', () => {
    const body = paragraph(2);
    const result = selectBodyDocuments(fields, { title: 'First', body, notes: '<p>hi</p>' });
    expect(result).toEqual({ hasBodyField: true, documents: [body, '<p>hi</p>'] });
  });

  it('drops empty rich-text values', () => {
    expect(selectBodyDocuments(fields, { body: null, notes: '   ' })).toEqual({
      hasBodyField: true,
      documents: [],
    });
  });

  it('reports that a body-less content type has no body field', () => {
    expect(selectBodyDocuments([{ name: 'name', type: 'TEXT' }], { name: 'x' })).toEqual({
      hasBodyField: false,
      documents: [],
    });
  });

  it('tolerates a locale whose data is not an object', () => {
    expect(selectBodyDocuments(fields, null).documents).toEqual([]);
  });
});

describe('checkBodyDocuments', () => {
  it('reports an empty body when nothing is present', () => {
    expect(checkBodyDocuments([]).map((i) => i.type)).toEqual(['body_missing']);
  });

  it('sums the word count across documents', () => {
    const issues = checkBodyDocuments([paragraph(150), paragraph(160)]);
    expect(issues.map((i) => i.type)).not.toContain('body_short');
  });

  it('flags a short body and a missing H2', () => {
    expect(checkBodyDocuments([paragraph(5)]).map((i) => i.type)).toEqual([
      'body_short',
      'body_no_h2',
    ]);
  });

  it('reads HTML-string bodies', () => {
    const html = `<h2>Intro</h2><p>${Array.from({ length: 320 }, (_, i) => `w${String(i)}`).join(' ')}</p>`;
    expect(checkBodyDocuments([html])).toEqual([]);
  });
});

describe('checkBody (single document, kept for callers)', () => {
  it('still reports a missing body for null', () => {
    expect(checkBody(null).map((i) => i.type)).toEqual(['body_missing']);
  });

  it('still scores one ProseMirror document', () => {
    expect(checkBody(paragraph(5)).map((i) => i.type)).toEqual(['body_short', 'body_no_h2']);
  });
});
