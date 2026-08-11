import type { ConfigService } from '@nestjs/config';
import type { Job } from 'bullmq';
import { createTransport } from 'nodemailer';
import type { Env } from '../../config/env.schema';
import { EmailProcessor } from './email.processor';

jest.mock('nodemailer', () => ({ createTransport: jest.fn() }));

const sendMail = jest.fn().mockResolvedValue(undefined);

function buildProcessor(env: Partial<Record<string, string>>): EmailProcessor {
  (createTransport as unknown as jest.Mock).mockReturnValue({ sendMail });
  const config = {
    get: jest.fn((key: string) => env[key]),
  } as unknown as ConfigService<Env>;
  return new EmailProcessor(config);
}

function buildJob(name: string, data: unknown): Job {
  return { name, data, id: 'job-1', attemptsMade: 0 } as unknown as Job;
}

function sentBody(): { html: string; text: string } {
  const call = sendMail.mock.calls[0]?.[0] as { html: string; text: string };
  return call;
}

describe('EmailProcessor links', () => {
  beforeEach(() => {
    sendMail.mockClear();
  });

  it('builds the reset link from ADMIN_URL, not the public site', async () => {
    const processor = buildProcessor({
      ADMIN_URL: 'https://cms.example.com/admin',
      SITE_URL: 'https://www.example.com',
    });

    await processor.process(buildJob('password-reset', { to: 'a@kast.local', token: 'raw tok' }));

    const { html, text } = sentBody();
    expect(text).toContain('https://cms.example.com/admin/reset-password?token=raw%20tok');
    expect(html).toContain('https://cms.example.com/admin/reset-password?token=raw%20tok');
    expect(html).not.toContain('https://www.example.com');
  });

  it('builds the invite link from ADMIN_URL and carries the token', async () => {
    const processor = buildProcessor({
      ADMIN_URL: 'https://cms.example.com/admin/',
      SITE_URL: 'https://www.example.com',
    });

    await processor.process(
      buildJob('user-invite', { to: 'a@kast.local', firstName: 'Ada', token: 'invite-tok' }),
    );

    const { text } = sentBody();
    // The trailing slash on ADMIN_URL must not survive into the link.
    expect(text).toContain('https://cms.example.com/admin/accept-invite?token=invite-tok');
    expect(text).not.toContain('//accept-invite');
  });

  it('falls back to the admin login page when an invite carries no token', async () => {
    const processor = buildProcessor({ ADMIN_URL: 'https://cms.example.com/admin' });

    await processor.process(buildJob('user-invite', { to: 'a@kast.local' }));

    expect(sentBody().text).toContain('https://cms.example.com/admin/login');
  });

  it('leaves a generic send untouched', async () => {
    const processor = buildProcessor({ ADMIN_URL: 'https://cms.example.com/admin' });

    await processor.process(
      buildJob('send', { to: 'a@kast.local', subject: 'Hi', html: '<p>Body</p>' }),
    );

    const call = sendMail.mock.calls[0]?.[0] as { subject: string; html: string };
    expect(call.subject).toBe('Hi');
    expect(call.html).toBe('<p>Body</p>');
  });
});
