import { type IKastPlugin, type KastPluginContext } from '@kast-cms/plugin-sdk';
import { type CreateEmailOptions, type CreateEmailResponse, Resend } from 'resend';

/** A single outbound message handed to the transport. */
export interface EmailMessage {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  replyTo?: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
}

const LOG_PREFIX = '[kast-plugin-resend]';

/**
 * Resend-backed email transport built on the official `resend` SDK. Provides a
 * `sendEmail` method so transactional mail (password resets, invites, …) can be
 * delivered through Resend, and persists its configuration so the admin UI /
 * core can detect that Resend is available.
 *
 * When enabled, the plugin registers itself as the host's outbound transport.
 */
export class ResendPlugin implements IKastPlugin {
  private resend: Resend | null = null;
  private fromAddress = '';

  async onLoad(ctx: KastPluginContext): Promise<void> {
    const apiKey = process.env['RESEND_API_KEY'] ?? '';
    const fromEmail = process.env['RESEND_FROM_EMAIL'] ?? '';
    const fromName = process.env['RESEND_FROM_NAME'] ?? '';

    if (!apiKey) {
      this.warn('RESEND_API_KEY not set — email will fall back to the host SMTP transport');
      return;
    }
    if (!fromEmail) {
      this.warn(
        'RESEND_FROM_EMAIL not set — sendEmail requires an explicit `from` until configured',
      );
    }

    this.resend = new Resend(apiKey);
    this.fromAddress = fromName && fromEmail ? `${fromName} <${fromEmail}>` : fromEmail;

    await ctx.setConfig({
      provider: 'resend',
      fromEmail: fromEmail || null,
      fromName: fromName || null,
      configuredAt: new Date().toISOString(),
    });

    ctx.registerEmailTransport({
      provider: 'resend',
      send: async (message) => {
        await this.sendEmail(message);
      },
    });

    this.log(`Active — Resend transport ready (from ${this.fromAddress || 'unset'})`);
  }

  /** True once a valid API key has been supplied. */
  isReady(): boolean {
    return this.resend !== null;
  }

  /**
   * Sends one email through Resend. Throws if the plugin was not configured with
   * an API key, or if no `from` address is available.
   */
  async sendEmail(message: EmailMessage): Promise<CreateEmailResponse> {
    const resend = this.requireResend();
    const from = message.from ?? this.fromAddress;
    if (!from) {
      throw new Error(
        `${LOG_PREFIX} no "from" address (set RESEND_FROM_EMAIL or pass message.from)`,
      );
    }
    if (!message.html && !message.text) {
      throw new Error(`${LOG_PREFIX} email must include "html" or "text" content`);
    }

    // `CreateEmailOptions` is a discriminated union enforcing "at least one of
    // html/text/react"; the runtime guard above guarantees html or text is set,
    // so the assembled object is cast to the SDK's parameter type. (Casting to
    // `CreateEmailOptions` directly rather than `Parameters<send>` because
    // `emails.send` is overloaded and `Parameters` would pick the wrong overload.)
    const payload = {
      from,
      to: message.to,
      subject: message.subject,
      ...(message.html !== undefined ? { html: message.html } : {}),
      ...(message.text !== undefined ? { text: message.text } : {}),
      ...(message.replyTo !== undefined ? { replyTo: message.replyTo } : {}),
      ...(message.cc !== undefined ? { cc: message.cc } : {}),
      ...(message.bcc !== undefined ? { bcc: message.bcc } : {}),
    } as CreateEmailOptions;

    const response = await resend.emails.send(payload);

    if (response.error) {
      throw new Error(`${LOG_PREFIX} Resend send failed: ${response.error.message}`);
    }
    return response;
  }

  private requireResend(): Resend {
    if (!this.resend) {
      throw new Error(`${LOG_PREFIX} sendEmail called before the plugin was configured`);
    }
    return this.resend;
  }

  async onUnload(): Promise<void> {
    this.resend = null;
  }

  private log(message: string): void {
    process.stderr.write(`${LOG_PREFIX} ${message}\n`);
  }

  private warn(message: string): void {
    process.stderr.write(`${LOG_PREFIX} WARN ${message}\n`);
  }
}

export default ResendPlugin;
