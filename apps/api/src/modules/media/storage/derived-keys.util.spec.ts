import { derivedStorageKeys, THUMBNAIL_WIDTHS } from './derived-keys.util';

const variantKeys = (storageKey: string): string[] => [
  `variants/thumbnail/${storageKey}.webp`,
  `variants/card/${storageKey}.webp`,
  `variants/hero/${storageKey}.webp`,
];

describe('derivedStorageKeys', () => {
  it('returns every object written beside an optimized upload', () => {
    // `optimize` repointed the row at <key>.webp and left the PNG behind.
    expect(derivedStorageKeys('2026/01/abc.png.webp').sort()).toEqual(
      [
        '2026/01/abc.png.webp',
        '2026/01/abc.png',
        'thumbs/400/2026/01/abc.png',
        'thumbs/800/2026/01/abc.png',
        ...variantKeys('2026/01/abc.png'),
      ].sort(),
    );
  });

  it('covers thumbnails for a row the optimizer never rewrote', () => {
    expect(derivedStorageKeys('2026/01/abc.pdf')).toEqual([
      '2026/01/abc.pdf',
      'thumbs/400/2026/01/abc.pdf',
      'thumbs/800/2026/01/abc.pdf',
      ...variantKeys('2026/01/abc.pdf'),
    ]);
  });

  it('never repeats a key', () => {
    const keys = derivedStorageKeys('a.png');
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('derives a thumbnail key for every width the processor renders', () => {
    // Guards the constant the processor and the purge share: a new width added
    // to one without the other would leak thumbnails on permanent delete.
    const keys = derivedStorageKeys('a.pdf');
    for (const width of THUMBNAIL_WIDTHS) {
      expect(keys).toContain(`thumbs/${String(width)}/a.pdf`);
    }
  });
});
