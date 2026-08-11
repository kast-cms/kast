import { ValidationPipe } from '@nestjs/common';
import { UpsertSeoMetaDto } from './seo-meta.dto';

/** The pipe main.ts installs, including the implicit conversion it enables. */
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: { enableImplicitConversion: true },
});

const meta = { type: 'body' as const, metatype: UpsertSeoMetaDto };

describe('UpsertSeoMetaDto', () => {
  it('does not turn noIndex/noFollow on for a string "false"', async () => {
    const dto = (await pipe.transform(
      { noIndex: 'false', noFollow: 'false' },
      meta,
    )) as UpsertSeoMetaDto;

    expect(dto).toMatchObject({ noIndex: false, noFollow: false });
  });

  it('keeps a real boolean', async () => {
    const dto = (await pipe.transform({ noIndex: true }, meta)) as UpsertSeoMetaDto;

    expect(dto.noIndex).toBe(true);
  });

  it('rejects a flag that is neither a boolean nor "true"/"false"', async () => {
    await expect(pipe.transform({ noIndex: 'nope' }, meta)).rejects.toThrow();
  });
});
