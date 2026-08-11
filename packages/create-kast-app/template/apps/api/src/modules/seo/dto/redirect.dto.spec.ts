import { ValidationPipe } from '@nestjs/common';
import { UpdateRedirectDto } from './redirect.dto';

/** The pipe main.ts installs, including the implicit conversion it enables. */
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: { enableImplicitConversion: true },
});

const meta = { type: 'body' as const, metatype: UpdateRedirectDto };

describe('UpdateRedirectDto', () => {
  it('does not activate a redirect sent as isActive="false"', async () => {
    const dto = (await pipe.transform({ isActive: 'false' }, meta)) as UpdateRedirectDto;

    expect(dto.isActive).toBe(false);
  });

  it('rejects a flag that is neither a boolean nor "true"/"false"', async () => {
    await expect(pipe.transform({ isActive: 'sometimes' }, meta)).rejects.toThrow();
  });
});
