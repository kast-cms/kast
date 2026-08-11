import { Transform } from 'class-transformer';
import { IsArray, IsBoolean, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { toBoolean } from '../../../common/dto/to-boolean.transform';
import { ALL_WEBHOOK_EVENT_NAMES } from '../webhook.events';
import { IsWebhookUrl } from './is-webhook-url.validator';

export class CreateWebhookDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @IsWebhookUrl()
  url!: string;

  @IsArray()
  @IsIn(ALL_WEBHOOK_EVENT_NAMES, { each: true })
  events!: string[];

  // Optional caller-supplied HMAC secret. When omitted, one is generated and
  // returned once on creation.
  @IsOptional()
  @IsString()
  @MinLength(8)
  secret?: string;
}

export class UpdateWebhookDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  @IsWebhookUrl()
  url?: string;

  @IsOptional()
  @IsArray()
  @IsIn(ALL_WEBHOOK_EVENT_NAMES, { each: true })
  events?: string[];

  @IsOptional()
  @IsString()
  @MinLength(8)
  secret?: string;

  @IsOptional()
  @IsBoolean()
  @Transform(toBoolean)
  isActive?: boolean;
}
