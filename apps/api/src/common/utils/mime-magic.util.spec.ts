import { validateMagicBytes } from './mime-magic.util';

describe('validateMagicBytes', () => {
  const jpegMagic = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
  const pngMagic = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
  const gifMagic = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]); // GIF89a
  const phpContent = Buffer.from('<?php echo "hello"; ?>');
  const pdfMagic = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]); // %PDF-1

  describe('JPEG', () => {
    it('accepts a valid JPEG buffer declared as image/jpeg', () => {
      expect(validateMagicBytes(jpegMagic, 'image/jpeg')).toBe(true);
    });

    it('rejects a PHP file buffer declared as image/jpeg (MIME spoofing)', () => {
      expect(validateMagicBytes(phpContent, 'image/jpeg')).toBe(false);
    });
  });

  describe('PNG', () => {
    it('accepts a valid PNG buffer declared as image/png', () => {
      expect(validateMagicBytes(pngMagic, 'image/png')).toBe(true);
    });

    it('rejects a JPEG buffer declared as image/png', () => {
      expect(validateMagicBytes(jpegMagic, 'image/png')).toBe(false);
    });
  });

  describe('GIF', () => {
    it('accepts a valid GIF buffer declared as image/gif', () => {
      expect(validateMagicBytes(gifMagic, 'image/gif')).toBe(true);
    });

    it('rejects arbitrary data declared as image/gif', () => {
      expect(validateMagicBytes(phpContent, 'image/gif')).toBe(false);
    });
  });

  describe('PDF', () => {
    it('accepts a valid PDF buffer declared as application/pdf', () => {
      expect(validateMagicBytes(pdfMagic, 'application/pdf')).toBe(true);
    });

    it('rejects a non-PDF file declared as application/pdf', () => {
      expect(validateMagicBytes(phpContent, 'application/pdf')).toBe(false);
    });
  });

  describe('unknown MIME type', () => {
    it('returns true for MIME types without a registered signature', () => {
      expect(validateMagicBytes(phpContent, 'application/octet-stream')).toBe(true);
    });
  });
});
