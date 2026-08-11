import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Job } from 'bullmq';
import { createTransport, type Transporter } from 'nodemailer';
import type { Env } from '../../config/env.schema';
import { QUEUE_NAMES } from '../queue/queue.constants';

export interface SendEmailJobData {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface PasswordResetJobData {
  to: string;
  token: string;
}

export interface UserInviteJobData {
  to: string;
  firstName?: string | null;
  token?: string;
}

type EmailJobData = SendEmailJobData | PasswordResetJobData | UserInviteJobData;

interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

@Processor(QUEUE_NAMES.EMAIL, { concurrency: 5 })
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);
  private readonly transporter: Transporter | null;
  private readonly from: string;
  private readonly resendApiKey: string | undefined;
  private readonly resendFrom: string;
  private readonly siteUrl: string;

  constructor(config: ConfigService<Env>) {
    super();
    this.from = config.get('SMTP_FROM', { infer: true }) ?? 'noreply@kast.io';
    this.resendApiKey = config.get('RESEND_API_KEY', { infer: true });
    this.resendFrom = config.get('RESEND_FROM_EMAIL', { infer: true }) ?? this.from;
    this.siteUrl = (config.get('SITE_URL', { infer: true }) ?? 'http://localhost:3001').replace(
      /\/$/,
      '',
    );

    if (this.resendApiKey) {
      this.transporter = null;
      this.logger.log('Email transport: Resend');
    } else {
      const user = config.get('SMTP_USER', { infer: true });
      const pass = config.get('SMTP_PASS', { infer: true });
      this.transporter = createTransport({
        host: config.get('SMTP_HOST', { infer: true }) ?? 'localhost',
        port: config.get('SMTP_PORT', { infer: true }) ?? 1025,
        secure: config.get('SMTP_SECURE', { infer: true }) ?? false,
        ...(user ? { auth: { user, pass: pass ?? '' } } : {}),
      });
      this.logger.log('Email transport: SMTP');
    }
  }

  async process(job: Job<EmailJobData>): Promise<void> {
    const rendered = this.render(job.name, job.data);
    const { to } = job.data;
    this.logger.log(`Sending email "${rendered.subject}" to ${to} (job ${job.id ?? ''})`);
    try {
      await this.deliver(to, rendered);
      this.logger.log(`Email delivered to ${to}`);
    } catch (err: unknown) {
      this.logger.error(`Failed to send email to ${to} (attempt ${job.attemptsMade + 1})`, err);
      throw err;
    }
  }

  /** Branches on the job name to build the right template; falls back to the generic send. */
  private render(jobName: string, data: EmailJobData): RenderedEmail {
    if (jobName === 'password-reset') {
      return this.renderPasswordReset(data as PasswordResetJobData);
    }
    if (jobName === 'user-invite') {
      return this.renderUserInvite(data as UserInviteJobData);
    }
    const generic = data as SendEmailJobData;
    return {
      subject: generic.subject,
      html: generic.html,
      text: generic.text ?? this.htmlToText(generic.html),
    };
  }

  private renderPasswordReset(data: PasswordResetJobData): RenderedEmail {
    const link = `${this.siteUrl}/reset-password?token=${encodeURIComponent(data.token)}`;
    const subject = 'Reset your Kast password';
    const html = [
      '<div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto">',
      '<h2>Reset your password</h2>',
      '<p>We received a request to reset your Kast CMS password. Click the button below to choose a new one. This link expires in 1 hour.</p>',
      `<p><a href="${link}" style="display:inline-block;padding:10px 18px;background:#111;color:#fff;border-radius:6px;text-decoration:none">Reset password</a></p>`,
      `<p>If the button does not work, paste this URL into your browser:</p><p><a href="${link}">${link}</a></p>`,
      '<p>If you did not request this, you can safely ignore this email.</p>',
      '</div>',
    ].join('');
    const text = `Reset your Kast password by visiting: ${link}\n\nThis link expires in 1 hour. If you did not request this, ignore this email.`;
    return { subject, html, text };
  }

  private renderUserInvite(data: UserInviteJobData): RenderedEmail {
    const greeting = data.firstName ? `Hi ${data.firstName},` : 'Hello,';
    const link = data.token
      ? `${this.siteUrl}/accept-invite?token=${encodeURIComponent(data.token)}`
      : `${this.siteUrl}/login`;
    const subject = 'You have been invited to Kast CMS';
    const html = [
      '<div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto">',
      `<h2>Welcome to Kast CMS</h2><p>${greeting}</p>`,
      '<p>An administrator has invited you to the Kast CMS admin panel.</p>',
      `<p><a href="${link}" style="display:inline-block;padding:10px 18px;background:#111;color:#fff;border-radius:6px;text-decoration:none">Get started</a></p>`,
      `<p>Or open: <a href="${link}">${link}</a></p>`,
      '</div>',
    ].join('');
    const text = `${greeting}\n\nYou have been invited to Kast CMS. Get started: ${link}`;
    return { subject, html, text };
  }

  private htmlToText(html: string): string {
    return html
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private async deliver(to: string, email: RenderedEmail): Promise<void> {
    if (this.resendApiKey) {
      await this.sendViaResend({ to, subject: email.subject, html: email.html, text: email.text });
      return;
    }
    if (!this.transporter) throw new Error('SMTP transporter not initialized');
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });
  }

  private async sendViaResend(data: {
    to: string;
    subject: string;
    html: string;
    text?: string;
  }): Promise<void> {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: this.resendFrom,
        to: [data.to],
        subject: data.subject,
        html: data.html,
        ...(data.text !== undefined ? { text: data.text } : {}),
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Resend API error ${res.status}: ${body}`);
    }
  }
}
