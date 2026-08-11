import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

/** Columns the media library is allowed to sort on. */
export enum MediaSortField {
  CREATED_AT = 'createdAt',
  FILENAME = 'filename',
  SIZE = 'size',
}

/**
 * Query parameters for `GET /api/v1/media`. The global ValidationPipe runs with
 * `forbidNonWhitelisted`, so every filter the admin media library sends has to be
 * declared here or the request is rejected with 400.
 */
export class ListMediaDto extends PaginationDto {
  @IsOptional()
  @IsString()
  folderId?: string;

  /** A MIME prefix such as `image/`, or a full type such as `image/png`. */
  @IsOptional()
  @IsString()
  mimeType?: string;

  /** Free-text match against filename, original name and alt text. */
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(MediaSortField)
  sort?: MediaSortField = MediaSortField.CREATED_AT;
}
