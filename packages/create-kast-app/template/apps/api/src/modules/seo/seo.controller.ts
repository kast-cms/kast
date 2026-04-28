import {
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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Redirect, SeoMeta } from '@prisma/client';
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
    const entries = await this.service.getSitemapEntries();
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
}
