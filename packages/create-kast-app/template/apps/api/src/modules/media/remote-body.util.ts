import { UnprocessableEntityException } from '@nestjs/common';

/**
 * Reads a remote body while never holding more than `maxBytes`: a declared
 * Content-Length over the limit is refused before anything is read, and the
 * stream is abandoned the moment it passes the limit. `arrayBuffer()` would
 * have made the very allocation the size check exists to prevent.
 */
export async function readBoundedBody(res: Response, maxBytes: number): Promise<Buffer> {
  const tooLarge = (): UnprocessableEntityException =>
    new UnprocessableEntityException(`File exceeds max size of ${maxBytes / 1024 / 1024}MB`);

  const declared = Number(res.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) throw tooLarge();

  const body = res.body as ReadableStream<Uint8Array> | null;
  if (!body) {
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length > maxBytes) throw tooLarge();
    return buffer;
  }

  const reader = body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw tooLarge();
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}
