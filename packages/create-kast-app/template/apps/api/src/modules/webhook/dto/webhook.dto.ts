import { IsArray, IsBoolean, IsIn, IsOptional, IsString, IsUrl, MinLength } from 'class-validator';
import { ALL_WEBHOOK_EVENT_NAMES } from '../webhook.events';

export class CreateWebhookDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsUrl({ require_tld: false })
  url!: string;

  @IsArray()
  @IsIn(ALL_WEBHOOK_EVENT_NAMES, { each: true })
  events!: string[];
}

export class UpdateWebhookDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  url?: string;

  @IsOptional()
  @IsArray()
  @IsIn(ALL_WEBHOOK_EVENT_NAMES, { each: true })
  events?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
