import { ValidationPipe } from '@nestjs/common';
import { PublishContentDto } from '../../modules/content/dto/content-entry.dto';
import { UpdateLocaleDto } from '../../modules/locales/dto/locale.dto';
import { CreateMenuItemDto, UpdateMenuItemDto } from '../../modules/menus/dto/menu.dto';
import { InviteUserDto, UpdateUserDto, UserListQueryDto } from '../../modules/users/dto/user.dto';
import { UpdateWebhookDto } from '../../modules/webhook/dto/webhook.dto';

/** The exact pipe main.ts installs, including the implicit conversion it enables. */
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: { enableImplicitConversion: true },
});

/**
 * Every declared boolean in the API, because implicit conversion applies a bare
 * `Boolean(value)` to all of them — a guard on some DTOs is not a guard.
 *
 * `"false"` is the interesting input: it is what an urlencoded form and a
 * hand-written client both send, and un-guarded it arrives as `true`, i.e. the
 * exact opposite of the request. `?isActive=false` listed ACTIVE users, and
 * `{"force":"false"}` bypassed the SEO publish gate.
 */
/** `base` carries whatever else the DTO requires, so only the flag is under test. */
const CASES: {
  name: string;
  metatype: new () => object;
  key: string;
  base?: Record<string, unknown>;
}[] = [
  { name: 'UserListQueryDto.isActive', metatype: UserListQueryDto, key: 'isActive' },
  { name: 'UpdateUserDto.isActive', metatype: UpdateUserDto, key: 'isActive' },
  { name: 'UpdateWebhookDto.isActive', metatype: UpdateWebhookDto, key: 'isActive' },
  { name: 'UpdateLocaleDto.isActive', metatype: UpdateLocaleDto, key: 'isActive' },
  {
    name: 'CreateMenuItemDto.isActive',
    metatype: CreateMenuItemDto,
    key: 'isActive',
    base: { label: 'Home', linkType: 'external_url' },
  },
  { name: 'UpdateMenuItemDto.isActive', metatype: UpdateMenuItemDto, key: 'isActive' },
  { name: 'PublishContentDto.force', metatype: PublishContentDto, key: 'force' },
];

describe('boolean DTO flags under the production pipe', () => {
  describe.each(CASES)('$name', ({ metatype, key, base }) => {
    const meta = { type: 'body' as const, metatype };
    const body = (value: unknown): Record<string, unknown> => ({ ...base, [key]: value });

    it('reads "false" as false, not true', async () => {
      const dto = (await pipe.transform(body('false'), meta)) as Record<string, unknown>;

      expect(dto[key]).toBe(false);
    });

    it('reads "true" as true', async () => {
      const dto = (await pipe.transform(body('true'), meta)) as Record<string, unknown>;

      expect(dto[key]).toBe(true);
    });

    it('keeps a real boolean', async () => {
      const dto = (await pipe.transform(body(false), meta)) as Record<string, unknown>;

      expect(dto[key]).toBe(false);
    });

    it('rejects a value that is neither a boolean nor "true"/"false"', async () => {
      await expect(pipe.transform(body('maybe'), meta)).rejects.toThrow();
    });
  });

  it('leaves an omitted optional flag undefined rather than false', async () => {
    const dto = (await pipe.transform(
      {},
      {
        type: 'body',
        metatype: UpdateUserDto,
      },
    )) as UpdateUserDto;

    expect(dto.isActive).toBeUndefined();
  });

  it('does not read an inherited Object.prototype member as a flag', async () => {
    // `sendInvite` is absent from the body; a polluted prototype must not supply it.
    const polluted = Object.create({ sendInvite: 'false' }) as Record<string, unknown>;
    polluted.email = 'a@b.com';
    polluted.roleNames = ['editor'];

    const dto = (await pipe.transform(polluted, {
      type: 'body',
      metatype: InviteUserDto,
    })) as InviteUserDto;

    expect(dto.sendInvite).toBeUndefined();
  });
});
