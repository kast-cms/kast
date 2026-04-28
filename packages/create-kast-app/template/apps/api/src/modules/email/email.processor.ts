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

@Processor(QUEUE_NAMES.EMAIL, { concurrency: 5 })
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);
  private readonly transporter: Transporter | null;
  private readonly from: string;
  private readonly resendApiKey: string | undefined;
  private readonly resendFrom: string;

  constructor(config: ConfigService<Env>) {
    super();
    this.from = config.get('SMTP_FROM', { infer: true }) ?? 'noreply@kast.io';
    this.resendApiKey = config.get('RESEND_API_KEY', { infer: true });
    this.resendFrom = config.get('RESEND_FROM_EMAIL', { infer: true }) ?? this.from;

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

  async process(job: Job<SendEmailJobData>): Promise<void> {
    const { to, subject, html, text } = job.data;
    this.logger.log(`Sending email "${subject}" to ${to} (job ${job.id})`);
    try {
      if (this.resendApiKey) {
        await this.sendViaResend({ to, subject, html, ...(text !== undefined ? { text } : {}) });
      } else {
        if (!this.transporter) throw new Error('SMTP transporter not initialized');
        await this.transporter.sendMail({
          from: this.from,
          to,
          subject,
          html,
          ...(text !== undefined ? { text } : {}),
        });
      }
      this.logger.log(`Email delivered to ${to}`);
    } catch (err: unknown) {
      this.logger.error(`Failed to send email to ${to} (attempt ${job.attemptsMade + 1})`, err);
      throw err;
    }
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
