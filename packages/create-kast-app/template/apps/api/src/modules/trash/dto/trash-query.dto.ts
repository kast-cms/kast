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
  /**
   * Display name of {@link trashedByUserId}, resolved for the returned page.
   * Null when the delete path recorded no actor or the account is itself gone —
   * the id alone is a cuid, which is not something a person can read.
   */
  trashedByName: string | null;
  daysUntilDeletion: number;
}

export interface TrashListResult {
  items: TrashedItemDto[];
  total: number;
  /** Opaque; pass it back as `cursor` to continue the merged listing. */
  nextCursor: string | null;
}

export interface TrashPurgeSummary {
  cutoff: Date;
  models: Record<TrashModel, { deleted: number; failed: number }>;
}
