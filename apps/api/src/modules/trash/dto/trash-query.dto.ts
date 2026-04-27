import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export const TRASH_MODELS = ['content', 'media', 'user', 'form'] as const;
export type TrashModel = (typeof TRASH_MODELS)[number];

export class TrashQueryDto {
  @IsOptional()
  @IsIn(TRASH_MODELS)
  model?: TrashModel;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  cursor?: string;
}

export interface TrashedItemDto {
  id: string;
  model: TrashModel;
  name: string;
  trashedAt: string;
  trashedByUserId: string | null;
  daysUntilDeletion: number;
}
