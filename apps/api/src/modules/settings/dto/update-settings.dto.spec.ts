import { ValidationPipe } from '@nestjs/common';
import { UpdateSettingsDto } from './update-settings.dto';

/** The pipe main.ts installs, including the implicit conversion it enables. */
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: { enableImplicitConversion: true },
});

const meta = { type: 'body' as const, metatype: UpdateSettingsDto };

describe('UpdateSettingsDto', () => {
  it('reads a string boolean on a nested entry as written', async () => {
    const dto = (await pipe.transform(
      { settings: [{ key: 'site.name', value: 'Kast', isPublic: 'false' }] },
      meta,
    )) as UpdateSettingsDto;

    expect(dto.settings[0]?.isPublic).toBe(false);
  });

  it('keeps a real boolean and leaves an omitted flag absent', async () => {
    const dto = (await pipe.transform(
      {
        settings: [
          { key: 'a', value: 1, isPublic: true },
          { key: 'b', value: 2 },
        ],
      },
      meta,
    )) as UpdateSettingsDto;

    expect(dto.settings[0]?.isPublic).toBe(true);
    expect(dto.settings[1]?.isPublic).toBeUndefined();
  });

  it('rejects a value that is neither a boolean nor "true"/"false"', async () => {
    await expect(
      pipe.transform({ settings: [{ key: 'a', value: 1, isPublic: 'maybe' }] }, meta),
    ).rejects.toThrow();
  });
});
