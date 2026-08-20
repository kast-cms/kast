import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  RawBodyRequest,
  Req,
  ServiceUnavailableException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import * as crypto from 'node:crypto';
import { Public } from '../../common/decorators/public.decorator';

interface StripeWebhookEvent {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
}

@ApiTags('stripe')
@Controller({ path: 'stripe', version: '1' })
export class StripeController {
  private readonly logger = new Logger(StripeController.name);

  constructor(private readonly emitter: EventEmitter2) {}

  @Post('webhook')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive Stripe webhook events (requires kast-plugin-stripe)' })
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
    @Body() _body: unknown,
  ): Promise<{ received: boolean }> {
    const webhookSecret = process.env['STRIPE_WEBHOOK_SECRET'];

    if (!webhookSecret) {
      throw new ServiceUnavailableException(
        'Stripe webhook is not configured. Set STRIPE_WEBHOOK_SECRET.',
      );
    }

    const rawBody = req.rawBody;
    if (!rawBody || !signature) {
      throw new BadRequestException('Missing raw body or Stripe-Signature header');
    }

    // Verify the Stripe webhook signature
    const event = this.verifyStripeSignature(rawBody, signature, webhookSecret);

    this.logger.log(`Stripe webhook received: ${event.type} (${event.id})`);
    this.emitter.emit('stripe.event', event);
    this.emitter.emit(`stripe.${event.type}`, event.data.object);

    return { received: true };
  }

  private verifyStripeSignature(
    rawBody: Buffer,
    signature: string,
    secret: string,
  ): StripeWebhookEvent {
    // Parsed into locals rather than a record keyed by header content: the
    // header is attacker-controlled, so it must never choose property names.
    let timestamp: string | undefined;
    let v1: string | undefined;
    for (const part of signature.split(',')) {
      const eq = part.indexOf('=');
      if (eq <= 0) continue;
      const name = part.slice(0, eq).trim();
      // Split on the first '=' only: values are not quoted and may contain it.
      const value = part.slice(eq + 1).trim();
      if (name === 't') timestamp = value;
      else if (name === 'v1') v1 = value;
    }

    if (!timestamp || !v1) {
      throw new BadRequestException('Invalid Stripe-Signature header format');
    }

    // Replay attack guard: reject webhooks older than 5 minutes
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - parseInt(timestamp, 10)) > 300) {
      throw new BadRequestException('Stripe webhook timestamp is too old');
    }

    const payload = `${timestamp}.${rawBody.toString('utf8')}`;
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');

    const expectedBuffer = Buffer.from(expected);
    const receivedBuffer = Buffer.from(v1);
    if (
      expectedBuffer.length !== receivedBuffer.length ||
      !crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
    ) {
      throw new BadRequestException('Stripe webhook signature mismatch');
    }

    return JSON.parse(rawBody.toString('utf8')) as StripeWebhookEvent;
  }
}
