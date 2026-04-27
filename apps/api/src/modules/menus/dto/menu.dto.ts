import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

// ── Menu DTOs ──────────────────────────────────────────────

export class CreateMenuDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty()
  @IsString()
  slug!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  localeCode?: string;
}

export class UpdateMenuDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  localeCode?: string;
}

// ── MenuItem DTOs ──────────────────────────────────────────

export const MENU_LINK_TYPES = ['content_entry', 'external_url', 'anchor', 'custom'] as const;
export type MenuLinkType = (typeof MENU_LINK_TYPES)[number];

export class CreateMenuItemDto {
  @ApiProperty()
  @IsString()
  label!: string;

  @ApiProperty({ enum: MENU_LINK_TYPES })
  @IsIn(MENU_LINK_TYPES)
  linkType!: MenuLinkType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  url?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  entryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  target?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  parentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateMenuItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  label?: string;

  @ApiPropertyOptional({ enum: MENU_LINK_TYPES })
  @IsOptional()
  @IsIn(MENU_LINK_TYPES)
  linkType?: MenuLinkType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  url?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  entryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  target?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  parentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// ── Reorder DTO ────────────────────────────────────────────

export class ReorderItemDto {
  @ApiProperty()
  @IsString()
  id!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  parentId?: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  order!: number;
}

export class ReorderMenuItemsDto {
  @ApiProperty({ type: [ReorderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderItemDto)
  items!: ReorderItemDto[];
}

// ── Public query ───────────────────────────────────────────

export class GetMenuQueryDto {
  @ApiPropertyOptional({
    description: 'Optional API key override (passed as query param fallback)',
  })
  @IsOptional()
  @IsString()
  key?: string;
}
