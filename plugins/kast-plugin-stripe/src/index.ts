import { type IKastPlugin, type KastPluginContext, PluginHook } from '@kast-cms/plugin-sdk';
import Stripe from 'stripe';
import { KastApiClient } from './kast-api';

/** Payload emitted on content.published / content.updated. */
interface ContentLifecyclePayload {
  entryId: string;
  typeSlug: string;
  status?: string;
}

/** Payload emitted on content.trashed. */
interface ContentRemovalPayload {
  entryId: string;
  typeSlug: string;
}

interface EntryLocale {
  data?: Record<string, unknown> | null;
}

interface KastEntry {
  id: string;
  locales?: EntryLocale[];
}

const LOG_PREFIX = '[kast-plugin-stripe]';
const METADATA_KEY = 'kastEntryId';

/**
 * Two-way bridge between a Kast `product` content type and Stripe, built on the
 * official `stripe` SDK.
 *
 *  - On publish/update of a product entry it upserts a matching Stripe Product
 *    (and a one-time Price when the entry carries a `price` field), keyed by
 *    `metadata.kastEntryId`.
 *  - On trash it archives the Stripe Product.
 *  - `handleWebhook` verifies and dispatches inbound Stripe webhook events using
 *    `STRIPE_WEBHOOK_SECRET`; `createCheckoutSession` starts a Checkout flow.
 *
 * The host's verified Stripe webhook is delivered through `stripe.event`.
 * Product field data is fetched over an authenticated HTTP call to the Kast
 * management API (see `KastApiClient`).
 */
export class StripePlugin implements IKastPlugin {
  private stripe: Stripe | null = null;
  private webhookSecret = '';
  private productTypeSlug = 'product';
  private readonly api = new KastApiClient((message) => this.warn(message));

  async onLoad(ctx: KastPluginContext): Promise<void> {
    const secretKey = process.env['STRIPE_SECRET_KEY'] ?? '';
    this.webhookSecret = process.env['STRIPE_WEBHOOK_SECRET'] ?? '';
    this.productTypeSlug = process.env['STRIPE_PRODUCT_TYPE_SLUG'] ?? 'product';

    if (!secretKey) {
      this.warn('STRIPE_SECRET_KEY not set — plugin disabled');
      return;
    }

    this.stripe = new Stripe(secretKey, {
      appInfo: { name: 'kast-plugin-stripe' },
      typescript: true,
    });

    if (!this.api.isConfigured) {
      this.warn('KAST_API_TOKEN not set — product entries cannot be read and nothing will sync');
    }

    ctx.on(PluginHook.CONTENT_PUBLISHED, (payload) => this.onPublish(payload));
    ctx.on(PluginHook.CONTENT_UPDATED, (payload) => this.onUpdate(payload));
    ctx.on(PluginHook.CONTENT_TRASHED, (payload) => this.onTrash(payload));
    ctx.on(PluginHook.STRIPE_EVENT, (payload) => this.dispatchEvent(payload as Stripe.Event));

    await ctx.setConfig({
      provider: 'stripe',
      productTypeSlug: this.productTypeSlug,
      webhookConfigured: this.webhookSecret.length > 0,
      contentApiConfigured: this.api.isConfigured,
      configuredAt: new Date().toISOString(),
    });

    this.log(`Ready — syncing "${this.productTypeSlug}" entries to Stripe`);
  }

  /**
   * Verifies a raw Stripe webhook request body against the signature header and
   * dispatches the resulting event. `rawBody` must be the unparsed request body
   * (string or Buffer) for signature verification to succeed.
   */
  async handleWebhook(rawBody: string | Buffer, signature: string): Promise<Stripe.Event> {
    const stripe = this.requireStripe();
    if (!this.webhookSecret) {
      throw new Error(`${LOG_PREFIX} STRIPE_WEBHOOK_SECRET not configured`);
    }
    const event = stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret);
    await this.dispatchEvent(event);
    return event;
  }

  /** Creates a Stripe Checkout session for the given price/quantity. */
  createCheckoutSession(
    params: Stripe.Checkout.SessionCreateParams,
  ): Promise<Stripe.Checkout.Session> {
    return this.requireStripe().checkout.sessions.create(params);
  }

  private async dispatchEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        this.log(`Checkout completed: ${session.id}`);
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        this.log(`Subscription ${event.type.split('.').pop() ?? ''}: ${sub.id} (${sub.status})`);
        break;
      }
      default:
        this.log(`Unhandled Stripe event: ${event.type}`);
    }
    return Promise.resolve();
  }

  private async onPublish(payload: unknown): Promise<void> {
    const p = payload as ContentLifecyclePayload;
    if (p.typeSlug !== this.productTypeSlug) return;
    await this.upsertProduct(p.entryId);
  }

  private async onUpdate(payload: unknown): Promise<void> {
    const p = payload as ContentLifecyclePayload;
    if (p.typeSlug !== this.productTypeSlug) return;
    if (p.status !== 'PUBLISHED') return;
    await this.upsertProduct(p.entryId);
  }

  private async onTrash(payload: unknown): Promise<void> {
    const p = payload as ContentRemovalPayload;
    if (p.typeSlug !== this.productTypeSlug) return;
    await this.archiveProduct(p.entryId);
  }

  private async upsertProduct(entryId: string): Promise<void> {
    const stripe = this.stripe;
    if (!stripe) return;
    try {
      const fields = await this.fetchEntryFields(entryId);
      if (!fields) {
        this.warn(`Could not fetch entry ${entryId}`);
        return;
      }

      const name = String(fields['name'] ?? fields['title'] ?? entryId);
      const description = fields['description'] != null ? String(fields['description']) : undefined;

      const existing = await this.findProduct(entryId);
      if (existing) {
        await stripe.products.update(existing.id, {
          name,
          ...(description !== undefined ? { description } : {}),
        });
        this.log(`Updated Stripe product ${existing.id}`);
        return;
      }

      const product = await stripe.products.create({
        name,
        ...(description !== undefined ? { description } : {}),
        metadata: { [METADATA_KEY]: entryId },
      });

      const priceField = fields['price'];
      if (typeof priceField === 'number' && priceField > 0) {
        const currency = String(fields['currency'] ?? 'usd').toLowerCase();
        await stripe.prices.create({
          product: product.id,
          unit_amount: Math.round(priceField * 100),
          currency,
        });
      }
      this.log(`Created Stripe product ${product.id}`);
    } catch (err) {
      this.error(`upsertProduct(${entryId}) failed: ${stringifyError(err)}`);
    }
  }

  private async archiveProduct(entryId: string): Promise<void> {
    const stripe = this.stripe;
    if (!stripe) return;
    try {
      const existing = await this.findProduct(entryId);
      if (!existing) return;
      await stripe.products.update(existing.id, { active: false });
      this.log(`Archived Stripe product ${existing.id}`);
    } catch (err) {
      this.error(`archiveProduct(${entryId}) failed: ${stringifyError(err)}`);
    }
  }

  /** Finds the Stripe product previously created for a Kast entry, if any. */
  private async findProduct(entryId: string): Promise<Stripe.Product | null> {
    const stripe = this.requireStripe();
    const result = await stripe.products.search({
      query: `metadata['${METADATA_KEY}']:'${entryId}'`,
      limit: 1,
    });
    return result.data[0] ?? null;
  }

  /**
   * Retrieves a product entry's field data from the Kast content API. See the
   * class-level note for why HTTP is used here rather than a context method.
   * A readable entry with no locale data yields `{}`; an unreadable one `null`.
   */
  private async fetchEntryFields(entryId: string): Promise<Record<string, unknown> | null> {
    const entry = await this.api.fetchEntry<KastEntry>(this.productTypeSlug, entryId);
    if (!entry) return null;
    return (entry.locales?.[0]?.data ?? {}) as Record<string, unknown>;
  }

  private requireStripe(): Stripe {
    if (!this.stripe) {
      throw new Error(`${LOG_PREFIX} Stripe client used before configuration`);
    }
    return this.stripe;
  }

  private log(message: string): void {
    process.stderr.write(`${LOG_PREFIX} ${message}\n`);
  }

  private warn(message: string): void {
    process.stderr.write(`${LOG_PREFIX} WARN ${message}\n`);
  }

  private error(message: string): void {
    process.stderr.write(`${LOG_PREFIX} ERROR ${message}\n`);
  }
}

function stringifyError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export default StripePlugin;
