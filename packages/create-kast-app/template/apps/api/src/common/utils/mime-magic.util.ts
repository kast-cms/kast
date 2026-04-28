/**
 * Validates a file buffer's magic bytes against its declared MIME type.
 *
 * Multer derives `file.mimetype` from the client's declared content-type header,
 * which can be spoofed. This utility reads the actual file bytes to verify the
 * declared type matches the real content, preventing MIME-type spoofing attacks.
 */

interface MimeSignature {
  /** Byte offset where the signature starts (default: 0). */
  offset?: number;
  /** Expected byte sequence. */
  bytes: readonly number[];
}

const SIGNATURES: Record<string, MimeSignature[]> = {
  'image/jpeg': [{ bytes: [0xff, 0xd8, 0xff] }],
  'image/png': [{ bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }],
  'image/gif': [{ bytes: [0x47, 0x49, 0x46, 0x38] }], // GIF8
  'image/webp': [
    { bytes: [0x52, 0x49, 0x46, 0x46] }, // RIFF at 0
    { offset: 8, bytes: [0x57, 0x45, 0x42, 0x50] }, // WEBP at 8
  ],
  'application/pdf': [{ bytes: [0x25, 0x50, 0x44, 0x46] }], // %PDF
};

/**
 * Returns `true` if the buffer's magic bytes match the declared MIME type.
 * Returns `true` for MIME types with no registered signature (permissive default).
 */
export function validateMagicBytes(buffer: Buffer, declaredMime: string): boolean {
  const signatures = SIGNATURES[declaredMime];
  if (!signatures || signatures.length === 0) return true;

  return signatures.every(({ offset = 0, bytes }) =>
    bytes.every((byte, i) => buffer[offset + i] === byte),
  );
}
