import { describe, expect, it } from '@/test/jest-globals';
import { blankToNull, clearable } from './nullable-field';

describe('blankToNull', () => {
  it('turns an emptied field into the null the API reads as "cleared"', () => {
    // The old `...(notifyEmail ? { notifyEmail } : {})` idiom dropped the key,
    // and the repository's `!== undefined` guard then kept the old recipient.
    expect(blankToNull('')).toBeNull();
    expect(blankToNull('   ')).toBeNull();
    expect(blankToNull(null)).toBeNull();
    expect(blankToNull(undefined)).toBeNull();
  });

  it('keeps a filled field, trimmed', () => {
    expect(blankToNull('alice@company.com')).toBe('alice@company.com');
    expect(blankToNull('  alice@company.com  ')).toBe('alice@company.com');
  });
});

describe('clearable', () => {
  it('puts null in the body even though the SDK types the field as a string', () => {
    const body = { notifyEmail: clearable('') };

    expect(body.notifyEmail).toBeNull();
    expect('notifyEmail' in body).toBe(true);
  });

  it('passes a filled field through unchanged', () => {
    expect(clearable('  alice@company.com ')).toBe('alice@company.com');
  });
});
