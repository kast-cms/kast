import { FormFieldType } from '@prisma/client';
import { validateFormField } from './form-field-validators';
import type { CompiledFormField } from './form-validation.types';

function field(overrides: Partial<CompiledFormField> = {}): CompiledFormField {
  return {
    name: 'f',
    type: FormFieldType.TEXT,
    required: false,
    config: {},
    pattern: null,
    ...overrides,
  };
}

function rulesOf(outcome: { issues: { rule: string }[] }): string[] {
  return outcome.issues.map((i) => i.rule);
}

describe('validateFormField', () => {
  describe('TEXT and TEXTAREA', () => {
    it('trims an accepted string', () => {
      expect(validateFormField(field(), '  hello  ')).toEqual({ value: 'hello', issues: [] });
    });

    it('rejects a non-string', () => {
      expect(rulesOf(validateFormField(field(), { $ne: null }))).toEqual(['type']);
    });

    it('enforces the configured bounds and pattern', () => {
      const f = field({ config: { minLength: 4, maxLength: 6 }, pattern: /^[a-z]+$/ });
      expect(rulesOf(validateFormField(f, 'ab'))).toEqual(['minLength']);
      expect(rulesOf(validateFormField(f, 'abcdefgh'))).toEqual(['maxLength']);
      expect(rulesOf(validateFormField(f, 'AB12'))).toEqual(['regex']);
    });

    it('caps an unbounded field so a field with no maxLength is not unbounded', () => {
      expect(rulesOf(validateFormField(field(), 'x'.repeat(10_001)))).toEqual(['maxLength']);
    });
  });

  describe('EMAIL', () => {
    const f = field({ type: FormFieldType.EMAIL });

    it('lowercases the domain of a valid address', () => {
      expect(validateFormField(f, ' Person@Example.COM ').value).toBe('Person@example.com');
    });

    it('rejects a malformed address', () => {
      expect(rulesOf(validateFormField(f, 'not-an-email'))).toEqual(['format']);
    });
  });

  describe('PHONE', () => {
    const f = field({ type: FormFieldType.PHONE });

    it('accepts an international number', () => {
      expect(validateFormField(f, '+1 (555) 010-9999').issues).toEqual([]);
    });

    it('rejects letters', () => {
      expect(rulesOf(validateFormField(f, 'call me'))).toEqual(['format']);
    });
  });

  describe('NUMBER', () => {
    const f = field({ type: FormFieldType.NUMBER, config: { min: 1, max: 10, isInteger: true } });

    it('coerces a numeric string', () => {
      expect(validateFormField(f, '5').value).toBe(5);
    });

    it('rejects a non-number and out-of-range values', () => {
      expect(rulesOf(validateFormField(f, 'abc'))).toEqual(['type']);
      expect(rulesOf(validateFormField(f, 0))).toEqual(['min']);
      expect(rulesOf(validateFormField(f, 99))).toEqual(['max']);
      expect(rulesOf(validateFormField(f, 2.5))).toEqual(['isInteger']);
    });
  });

  describe('SELECT and RADIO', () => {
    const f = field({ type: FormFieldType.SELECT, config: { choices: ['a', 'b'] } });

    it('accepts a configured choice', () => {
      expect(validateFormField(f, 'a')).toEqual({ value: 'a', issues: [] });
    });

    it('rejects a value outside the choices without naming them', () => {
      const outcome = validateFormField(f, 'c');
      expect(rulesOf(outcome)).toEqual(['choice']);
      expect(outcome.issues[0]?.message).not.toContain('a, b');
    });

    it('accepts any string when the form configured no choices', () => {
      expect(validateFormField(field({ type: FormFieldType.RADIO }), 'free').issues).toEqual([]);
    });
  });

  describe('MULTI_SELECT', () => {
    const f = field({
      type: FormFieldType.MULTI_SELECT,
      config: { choices: ['a', 'b'], maxItems: 2 },
    });

    it('deduplicates accepted values', () => {
      expect(validateFormField(f, ['a', 'a', 'b']).value).toEqual(['a', 'b']);
    });

    it('rejects a non-array, a bad choice and too many entries', () => {
      expect(rulesOf(validateFormField(f, 'a'))).toEqual(['type']);
      expect(rulesOf(validateFormField(f, ['a', 'zzz']))).toEqual(['choice']);
      expect(rulesOf(validateFormField(f, ['a', 'b', 'c']))).toEqual(['choice', 'maxItems']);
    });
  });

  describe('CHECKBOX', () => {
    const f = field({ type: FormFieldType.CHECKBOX });

    it('accepts the shapes a browser posts', () => {
      expect(validateFormField(f, true).value).toBe(true);
      expect(validateFormField(f, 'on').value).toBe(true);
      expect(validateFormField(f, 'false').value).toBe(false);
    });

    it('rejects anything else', () => {
      expect(rulesOf(validateFormField(f, 'maybe'))).toEqual(['type']);
    });
  });

  describe('DATE', () => {
    const f = field({ type: FormFieldType.DATE });

    it('accepts a date and a date-time', () => {
      expect(validateFormField(f, '2026-08-10').issues).toEqual([]);
      expect(validateFormField(f, '2026-08-10T12:30:00Z').issues).toEqual([]);
    });

    it('rejects a non-date and a day that does not exist', () => {
      expect(rulesOf(validateFormField(f, '10/08/2026'))).toEqual(['format']);
      expect(rulesOf(validateFormField(f, '2026-02-31'))).toEqual(['format']);
    });
  });

  describe('FILE', () => {
    const f = field({ type: FormFieldType.FILE });

    it('accepts a reference string', () => {
      expect(validateFormField(f, 'media-123').value).toBe('media-123');
    });

    it('rejects an embedded payload', () => {
      expect(rulesOf(validateFormField(f, { bytes: 'AAAA' }))).toEqual(['type']);
      expect(rulesOf(validateFormField(f, 'x'.repeat(2049)))).toEqual(['maxLength']);
    });
  });
});
