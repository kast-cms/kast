import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Redirect, SeoMeta } from '@prisma/client';
import type { Response } from 'express';
import { SYSTEM_ROLES } from '../../common/constants/roles.constants';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import type { AuthUser, PaginatedResult } from '../../common/types/auth.types';
import { CreateRedirectDto, UpdateRedirectDto } from './dto/redirect.dto';
import { UpsertSeoMetaDto } from './dto/seo-meta.dto';
import type { SeoMetaFull, SeoScoreWithIssues } from './seo.repository';
import { SeoService } from './seo.service';
import { buildSitemapXml } from './sitemap.builder';

interface RedirectImportResult {
  imported: number;
  skipped: number;
  errors: { row: number; reason: string }[];
}

@ApiTags('seo')
@Controller({ path: 'seo', version: '1' })
export class SeoController {
  constructor(private readonly service: SeoService) {}

  @Get('meta/:entryId')
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.VIEWER, SYSTEM_ROLES.EDITOR, SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get SEO meta for an entry' })
  getMeta(@Param('entryId') entryId: string): Promise<{ data: SeoMetaFull }> {
    return this.service.getMeta(entryId).then((data) => ({ data }));
  }

  @Put('meta/:entryId')
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.EDITOR, SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Upsert SEO meta for an entry' })
  upsertMeta(
    @Param('entryId') entryId: string,
    @Body() dto: UpsertSeoMetaDto,
  ): Promise<{ data: SeoMeta }> {
    return this.service.upsertMeta(entryId, dto).then((data) => ({ data }));
  }

  @Get('score/:entryId')
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.VIEWER, SYSTEM_ROLES.EDITOR, SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get latest SEO score for an entry' })
  getScore(@Param('entryId') entryId: string): Promise<{ data: SeoScoreWithIssues }> {
    return this.service.getScore(entryId).then((data) => ({ data }));
  }

  @Get('scores/:entryId')
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.VIEWER, SYSTEM_ROLES.EDITOR, SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get historical SEO scores for an entry' })
  getScores(
    @Param('entryId') entryId: string,
    @Query() query: PaginationDto,
  ): Promise<PaginatedResult<SeoScoreWithIssues>> {
    return this.service.getScoreHistory(entryId, query.limit ?? 20, query.cursor);
  }

  @Post('validate/:entryId')
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.EDITOR, SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Trigger SEO validation job for an entry' })
  validate(@Param('entryId') entryId: string): Promise<{ queued: boolean }> {
    return this.service.enqueueValidation(entryId);
  }

  @Get('sitemap.xml')
  @Public()
  @Header('Content-Type', 'application/xml')
  @ApiOperation({ summary: 'Generate and serve sitemap.xml' })
  async getSitemap(): Promise<string> {
    const entries = await this.service.buildSitemapEntries();
    return buildSitemapXml(entries);
  }

  @Get('redirects')
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.VIEWER, SYSTEM_ROLES.EDITOR, SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'List redirect rules' })
  listRedirects(@Query() query: PaginationDto): Promise<PaginatedResult<Redirect>> {
    return this.service.listRedirects(query);
  }

  @Post('redirects')
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a redirect rule' })
  createRedirect(
    @Body() dto: CreateRedirectDto,
    @CurrentUser() user: AuthUser,
  ): Promise<{ data: Redirect }> {
    return this.service.createRedirect(dto, user.id).then((data) => ({ data }));
  }

  @Patch('redirects/:id')
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update a redirect rule' })
  updateRedirect(
    @Param('id') id: string,
    @Body() dto: UpdateRedirectDto,
  ): Promise<{ data: Redirect }> {
    return this.service.updateRedirect(id, dto).then((data) => ({ data }));
  }

  @Delete('redirects/:id')
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a redirect rule' })
  deleteRedirect(@Param('id') id: string): Promise<void> {
    return this.service.deleteRedirect(id);
  }

  @Post('redirects/import')
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Bulk import redirects from a CSV file' })
  async importRedirects(
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: AuthUser,
  ): Promise<{ data: RedirectImportResult }> {
    if (!file?.buffer) {
      throw new BadRequestException('A CSV file is required in the "file" field');
    }
    const data = await this.service.importRedirects(file.buffer.toString('utf8'), user.id);
    return { data };
  }

  @Get('redirects/export')
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @Header('Content-Type', 'text/csv')
  @ApiOperation({ summary: 'Export all redirects as CSV' })
  async exportRedirects(@Res() res: Response): Promise<void> {
    const csv = await this.service.exportRedirectsCsv();
    res.setHeader('Content-Disposition', 'attachment; filename="redirects.csv"');
    res.send(csv);
  }
}
