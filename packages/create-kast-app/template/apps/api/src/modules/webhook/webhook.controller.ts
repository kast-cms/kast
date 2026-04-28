import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { WebhookDelivery } from '@prisma/client';
import { SYSTEM_ROLES } from '../../common/constants/roles.constants';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateWebhookDto, UpdateWebhookDto } from './dto/webhook.dto';
import type { EndpointRow } from './webhook.repository';
import { WebhookService, type WebhookCreatedResult } from './webhook.service';

@ApiTags('webhooks')
@Controller({ path: 'webhooks', version: '1' })
@ApiBearerAuth()
@Roles(SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
export class WebhookController {
  constructor(private readonly service: WebhookService) {}

  @Get()
  @ApiOperation({ summary: 'List webhook endpoints' })
  list(): Promise<EndpointRow[]> {
    return this.service.list();
  }

  @Post()
  @ApiOperation({ summary: 'Create a webhook endpoint' })
  create(@Body() dto: CreateWebhookDto): Promise<WebhookCreatedResult> {
    return this.service.create(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get webhook endpoint' })
  findOne(@Param('id') id: string): Promise<EndpointRow> {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update webhook endpoint' })
  update(@Param('id') id: string, @Body() dto: UpdateWebhookDto): Promise<EndpointRow> {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete webhook endpoint' })
  async delete(@Param('id') id: string): Promise<void> {
    await this.service.delete(id);
  }

  @Post(':id/test')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Send a test delivery to webhook endpoint' })
  async test(@Param('id') id: string): Promise<void> {
    await this.service.test(id);
  }

  @Get(':id/deliveries')
  @ApiOperation({ summary: 'List delivery log for webhook endpoint' })
  deliveries(@Param('id') id: string): Promise<WebhookDelivery[]> {
    return this.service.getDeliveries(id);
  }

  @Post(':id/deliveries/:deliveryId/redeliver')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Re-deliver a webhook delivery' })
  async redeliver(@Param('id') id: string, @Param('deliveryId') deliveryId: string): Promise<void> {
    await this.service.redeliver(id, deliveryId);
  }
}
