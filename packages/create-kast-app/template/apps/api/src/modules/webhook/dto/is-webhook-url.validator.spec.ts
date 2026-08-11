import { validate } from 'class-validator';
import { CreateWebhookDto, UpdateWebhookDto } from './webhook.dto';

function buildCreate(url: unknown): CreateWebhookDto {
  const dto = new CreateWebhookDto();
  dto.name = 'Hook';
  dto.url = url as string;
  dto.events = ['content.published'];
  return dto;
}

describe('IsWebhookUrl', () => {
  beforeEach(() => {
    delete process.env.WEBHOOK_ALLOWED_HOSTS;
  });

  afterAll(() => {
    delete process.env.WEBHOOK_ALLOWED_HOSTS;
  });

  it.each([
    'http://127.0.0.1:3000/api/v1/content-types',
    'http://169.254.169.254/latest/meta-data/',
    'http://localhost/x',
    'https://[::1]/x',
    'http://[fd00::1]/x',
    'http://[::ffff:7f00:1]/x',
    'http://10.0.0.5/x',
    'http://192.168.0.5:8080/x',
    'http://vault.internal/hook',
    'ftp://example.com/x',
    'file:///etc/passwd',
    'javascript:alert(1)',
    'not a url',
    42,
  ])('rejects %s on create', async (url) => {
    const errors = await validate(buildCreate(url));
    expect(errors.map((e) => e.property)).toContain('url');
  });

  it('accepts a public https endpoint', async () => {
    expect(await validate(buildCreate('https://example.com/hook'))).toHaveLength(0);
  });

  it('accepts an internal endpoint once the allow-list names it', async () => {
    process.env.WEBHOOK_ALLOWED_HOSTS = '127.0.0.1, *.internal';
    expect(await validate(buildCreate('http://127.0.0.1:3000/hook'))).toHaveLength(0);
    expect(await validate(buildCreate('http://vault.internal/hook'))).toHaveLength(0);
  });

  it('names the reason in the validation message', async () => {
    const [error] = await validate(buildCreate('ftp://example.com/x'));
    expect(Object.values(error?.constraints ?? {}).join(' ')).toContain('http or https');
  });

  it('applies to update as well, and stays optional', async () => {
    const dto = new UpdateWebhookDto();
    expect(await validate(dto)).toHaveLength(0);
    dto.url = 'http://127.0.0.1/x';
    expect((await validate(dto)).map((e) => e.property)).toContain('url');
  });
});
