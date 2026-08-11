import { describe, expect, it } from '@/test/jest-globals';
import { toSeoWarnings } from './seo-warnings';

describe('toSeoWarnings', () => {
  it('reads the issue list the API attaches to a blocked publish', () => {
    // The shape assertSeoPublishable throws: `details` is validation.warnings.
    const details = [
      { rule: 'title_too_short', message: 'Meta title is shorter than 30 characters.' },
      { rule: 'desc_missing', message: 'Meta description is missing.' },
    ];

    expect(toSeoWarnings(details)).toEqual(details);
  });

  it('keeps an issue that carries no rule, since the message is what is shown', () => {
    expect(toSeoWarnings([{ message: 'Something is off.' }])).toEqual([
      { rule: '', message: 'Something is off.' },
    ]);
  });

  it('drops entries with no usable message instead of rendering an object', () => {
    expect(toSeoWarnings([{ rule: 'x' }, null, 'nope', 42, { message: 7 }])).toEqual([]);
  });

  it('returns an empty list when the API sent no details at all', () => {
    // A generic 422 with no `details` must still open the dialog, not throw
    // inside the error handler.
    expect(toSeoWarnings(undefined)).toEqual([]);
    expect(toSeoWarnings(null)).toEqual([]);
    expect(toSeoWarnings({ issues: [] })).toEqual([]);
  });
});
