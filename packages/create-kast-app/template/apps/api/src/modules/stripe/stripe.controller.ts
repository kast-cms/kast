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
    this.emitter.emit(`stripe.${event.type}`, event.data.object);

    return { received: true };
  }

  private verifyStripeSignature(
    rawBody: Buffer,
    signature: string,
    secret: string,
  ): StripeWebhookEvent {
    const parts = signature.split(',').reduce<Record<string, string>>((acc, part) => {
      const [k, v] = part.split('=');
      if (k && v) acc[k] = v;
      return acc;
    }, {});

    const timestamp = parts['t'];
    const v1 = parts['v1'];

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

    if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1))) {
      throw new BadRequestException('Stripe webhook signature mismatch');
    }

    return JSON.parse(rawBody.toString('utf8')) as StripeWebhookEvent;
  }
}
