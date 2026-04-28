import { IKastPlugin, KastPluginContext } from '@kast-cms/plugin-sdk';

/**
 * kast-plugin-resend
 *
 * Activates the Resend email transport in the Kast API.
 * When RESEND_API_KEY is set, the API's EmailProcessor automatically
 * uses Resend instead of SMTP — no code changes required.
 *
 * This plugin registers itself, validates the required environment
 * variables at boot, and exposes a test-email endpoint for the admin UI.
 */
export class ResendPlugin implements IKastPlugin {
  async onLoad(ctx: KastPluginContext): Promise<void> {
    const apiKey = process.env['RESEND_API_KEY'];
    const fromEmail = process.env['RESEND_FROM_EMAIL'];

    if (!apiKey) {
      console.warn('[kast-plugin-resend] RESEND_API_KEY not set — email will fall back to SMTP');
      return;
    }

    if (!fromEmail) {
      console.warn(
        '[kast-plugin-resend] RESEND_FROM_EMAIL not set — using default SMTP_FROM address',
      );
    }

    // Persist config so admin UI can display the status
    await ctx.setConfig({
      provider: 'resend',
      fromEmail: fromEmail ?? null,
      fromName: process.env['RESEND_FROM_NAME'] ?? null,
      configuredAt: new Date().toISOString(),
    });

    console.log(
      `[kast-plugin-resend] Active — sending email via Resend from ${fromEmail ?? 'default'}`,
    );
  }
}

export default ResendPlugin;
