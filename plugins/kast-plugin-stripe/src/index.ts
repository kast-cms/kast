import { IKastPlugin, KastPluginContext, PluginHook } from '@kast-cms/plugin-sdk';

interface ContentPayload {
  entryId: string;
  typeSlug: string;
  status?: string;
}

interface StripeProduct {
  id: string;
  name: string;
  description?: string;
  metadata: Record<string, string>;
}

interface StripePrice {
  id: string;
  product: string;
  unit_amount: number;
  currency: string;
}

interface KastEntry {
  id: string;
  fields: Record<string, unknown>;
}

export class StripePlugin implements IKastPlugin {
  private secretKey = '';
  private productTypeSlug = 'product';
  private stripeApiBase = 'https://api.stripe.com/v1';

  async onLoad(ctx: KastPluginContext): Promise<void> {
    this.secretKey = process.env['STRIPE_SECRET_KEY'] ?? '';
    this.productTypeSlug = process.env['STRIPE_PRODUCT_TYPE_SLUG'] ?? 'product';

    if (!this.secretKey) {
      console.warn('[kast-plugin-stripe] STRIPE_SECRET_KEY not set — plugin disabled');
      return;
    }

    ctx.on(PluginHook.CONTENT_PUBLISHED, async (payload) => {
      const p = payload as ContentPayload;
      if (p.typeSlug !== this.productTypeSlug) return;
      await this.syncProduct(p.entryId, 'upsert');
    });

    ctx.on(PluginHook.CONTENT_UPDATED, async (payload) => {
      const p = payload as ContentPayload;
      if (p.typeSlug !== this.productTypeSlug) return;
      if (p.status !== 'PUBLISHED') return;
      await this.syncProduct(p.entryId, 'upsert');
    });

    ctx.on(PluginHook.CONTENT_TRASHED, async (payload) => {
      const p = payload as ContentPayload;
      if (p.typeSlug !== this.productTypeSlug) return;
      await this.syncProduct(p.entryId, 'archive');
    });

    console.log(
      `[kast-plugin-stripe] Ready — syncing "${this.productTypeSlug}" content type to Stripe`,
    );
  }

  private async fetchEntry(entryId: string, typeSlug: string): Promise<KastEntry | null> {
    try {
      const kastApiBase = (process.env['KAST_API_URL'] ?? 'http://localhost:3001').replace(
        /\/$/,
        '',
      );
      const res = await fetch(`${kastApiBase}/api/v1/content/${typeSlug}/${entryId}`, {
        headers: { 'x-kast-internal': 'plugin' },
      });
      if (!res.ok) return null;
      const json = (await res.json()) as { data: KastEntry };
      return json.data;
    } catch {
      return null;
    }
  }

  private async syncProduct(entryId: string, action: 'upsert' | 'archive'): Promise<void> {
    const entry = await this.fetchEntry(entryId, this.productTypeSlug);
    if (!entry) {
      console.warn(`[kast-plugin-stripe] Could not fetch entry ${entryId}`);
      return;
    }

    const name = String(entry.fields['name'] ?? entry.fields['title'] ?? entryId);
    const description =
      entry.fields['description'] != null ? String(entry.fields['description']) : undefined;

    try {
      if (action === 'archive') {
        // Look up product by metadata.kastEntryId and archive it
        const existing = await this.findStripeProduct(entryId);
        if (existing) {
          await this.stripeRequest('POST', `/products/${existing.id}`, { active: false });
          console.log(`[kast-plugin-stripe] Archived Stripe product ${existing.id}`);
        }
        return;
      }

      const existing = await this.findStripeProduct(entryId);
      if (existing) {
        await this.stripeRequest('POST', `/products/${existing.id}`, {
          name,
          ...(description !== undefined ? { description } : {}),
        });
        console.log(`[kast-plugin-stripe] Updated Stripe product ${existing.id}`);
      } else {
        const product = await this.stripeRequest<StripeProduct>('POST', '/products', {
          name,
          ...(description !== undefined ? { description } : {}),
          metadata: { kastEntryId: entryId },
        });

        // Create a price if `price` field exists on the entry
        const priceAmount = entry.fields['price'];
        if (typeof priceAmount === 'number' && priceAmount > 0) {
          const currency = String(entry.fields['currency'] ?? 'usd').toLowerCase();
          await this.stripeRequest<StripePrice>('POST', '/prices', {
            product: product.id,
            unit_amount: Math.round(priceAmount * 100),
            currency,
          });
        }

        console.log(`[kast-plugin-stripe] Created Stripe product ${product.id}`);
      }
    } catch (err) {
      console.error(`[kast-plugin-stripe] syncProduct error: ${String(err)}`);
    }
  }

  private async findStripeProduct(kastEntryId: string): Promise<StripeProduct | null> {
    try {
      const res = await this.stripeRequest<{ data: StripeProduct[] }>(
        'GET',
        `/products?metadata[kastEntryId]=${encodeURIComponent(kastEntryId)}&limit=1`,
      );
      return res.data[0] ?? null;
    } catch {
      return null;
    }
  }

  private async stripeRequest<T = unknown>(
    method: string,
    path: string,
    body?: Record<string, unknown>,
  ): Promise<T> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    };

    let bodyStr: string | undefined;
    if (body !== undefined && method !== 'GET') {
      bodyStr = Object.entries(body)
        .flatMap(([k, v]) => {
          if (typeof v === 'object' && v !== null) {
            return Object.entries(v as Record<string, string>).map(
              ([sk, sv]) =>
                `${encodeURIComponent(`${k}[${sk}]`)}=${encodeURIComponent(String(sv))}`,
            );
          }
          return [`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`];
        })
        .join('&');
    }

    const res = await fetch(`${this.stripeApiBase}${path}`, {
      method,
      headers,
      ...(bodyStr !== undefined ? { body: bodyStr } : {}),
    });

    const json = (await res.json()) as T;
    if (!res.ok) {
      throw new Error(`Stripe ${method} ${path} → ${res.status}`);
    }
    return json;
  }
}

export default StripePlugin;
