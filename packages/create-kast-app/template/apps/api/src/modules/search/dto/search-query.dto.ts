import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

/**
 * Validates the search query string.
 *
 * Without this, `limit=abc` became `Math.min(NaN, 100)` -> NaN and was
 * serialised into the Meilisearch request body as `null`, and a negative
 * `limit` was passed straight through for Meilisearch to reject.
 */
export class SearchQueryDto {
  @ApiPropertyOptional({ description: 'Search query' })
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  q!: string;

  @ApiPropertyOptional({ description: 'Content type slug' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  type?: string;

  @ApiPropertyOptional({ description: 'Results per page (max 100)', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ description: 'Result offset', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}
