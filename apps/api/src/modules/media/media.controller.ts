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
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import type { MediaFile } from '@prisma/client';
import { IsOptional, IsString } from 'class-validator';
import { SYSTEM_ROLES } from '../../common/constants/roles.constants';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import type { AuthUser, PaginatedResult } from '../../common/types/auth.types';
import { CreateFolderDto, UpdateFolderDto, UploadFromUrlDto } from './dto/media-folder.dto';
import { MediaFolderService, type MediaFolderResponse } from './media-folder.service';
import { MediaService } from './media.service';

class UpdateMediaDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  altText?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  caption?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  folderId?: string;
}

@ApiTags('media')
@Controller({ path: 'media', version: '1' })
export class MediaController {
  constructor(
    private readonly service: MediaService,
    private readonly folders: MediaFolderService,
  ) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'List media files' })
  findAll(@Query() query: PaginationDto): Promise<PaginatedResult<MediaFile>> {
    return this.service.findAll(query);
  }

  @Post()
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.EDITOR, SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @UseInterceptors(FileInterceptor('file', { storage: undefined }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a media file' })
  upload(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthUser,
  ): Promise<{ data: MediaFile }> {
    return this.service.upload(file, user.id);
  }

  @Post('upload-url')
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.EDITOR, SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Upload a media file from a remote URL' })
  uploadFromUrl(
    @Body() dto: UploadFromUrlDto,
    @CurrentUser() user: AuthUser,
  ): Promise<{ data: MediaFile }> {
    return this.service.uploadFromUrl(dto.url, user.id, {
      ...(dto.folderId !== undefined ? { folderId: dto.folderId } : {}),
      ...(dto.altText !== undefined ? { altText: dto.altText } : {}),
    });
  }

  // ── Folders (declared before :id so "folders" is not captured as an id) ──

  @Get('folders')
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.VIEWER, SYSTEM_ROLES.EDITOR, SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'List media folders' })
  listFolders(): Promise<PaginatedResult<MediaFolderResponse>> {
    return this.folders.list();
  }

  @Post('folders')
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.EDITOR, SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a media folder' })
  createFolder(@Body() dto: CreateFolderDto): Promise<{ data: MediaFolderResponse }> {
    return this.folders.create(dto.name, dto.parentId);
  }

  @Patch('folders/:id')
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.EDITOR, SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Rename or move a media folder' })
  updateFolder(
    @Param('id') id: string,
    @Body() dto: UpdateFolderDto,
  ): Promise<{ data: MediaFolderResponse }> {
    return this.folders.update(id, {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.parentId !== undefined ? { parentId: dto.parentId } : {}),
    });
  }

  @Delete('folders/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete an empty media folder' })
  async deleteFolder(@Param('id') id: string): Promise<void> {
    await this.folders.delete(id);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get media file by ID' })
  findOne(@Param('id') id: string): Promise<{ data: MediaFile }> {
    return this.service.findById(id);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.EDITOR, SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update media file metadata' })
  update(@Param('id') id: string, @Body() dto: UpdateMediaDto): Promise<{ data: MediaFile }> {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.EDITOR, SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete a media file' })
  remove(@Param('id') id: string): Promise<void> {
    return this.service.delete(id);
  }
}
