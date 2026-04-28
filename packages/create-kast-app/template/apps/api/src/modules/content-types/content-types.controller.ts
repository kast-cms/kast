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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ContentField } from '@prisma/client';
import { SYSTEM_ROLES } from '../../common/constants/roles.constants';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { ContentTypeWithFields } from './content-types.repository';
import { ContentTypesService } from './content-types.service';
import {
  CreateContentTypeDto,
  CreateFieldDto,
  UpdateContentTypeDto,
  UpdateFieldDto,
} from './dto/content-type.dto';

@ApiTags('content-types')
@Controller({ path: 'content-types', version: '1' })
export class ContentTypesController {
  constructor(private readonly service: ContentTypesService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'List all content types' })
  findAll(): Promise<{ data: ContentTypeWithFields[] }> {
    return this.service.findAll().then((data) => ({ data }));
  }

  @Post()
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a content type' })
  create(@Body() dto: CreateContentTypeDto): Promise<{ data: ContentTypeWithFields }> {
    return this.service.create(dto).then((data) => ({ data }));
  }

  @Get(':name')
  @Public()
  @ApiOperation({ summary: 'Get a content type by name' })
  findOne(@Param('name') name: string): Promise<{ data: ContentTypeWithFields }> {
    return this.service.findByName(name).then((data) => ({ data }));
  }

  @Patch(':name')
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update a content type' })
  update(
    @Param('name') name: string,
    @Body() dto: UpdateContentTypeDto,
  ): Promise<{ data: ContentTypeWithFields }> {
    return this.service.update(name, dto).then((data) => ({ data }));
  }

  @Delete(':name')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete a content type' })
  remove(@Param('name') name: string): Promise<void> {
    return this.service.delete(name);
  }

  @Post(':name/fields')
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Add a field to a content type' })
  createField(
    @Param('name') name: string,
    @Body() dto: CreateFieldDto,
  ): Promise<{ data: ContentField }> {
    return this.service.createField(name, dto).then((data) => ({ data }));
  }

  @Patch(':name/fields/:fieldName')
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update a field on a content type' })
  updateField(
    @Param('name') name: string,
    @Param('fieldName') fieldName: string,
    @Body() dto: UpdateFieldDto,
  ): Promise<{ data: ContentField }> {
    return this.service.updateField(name, fieldName, dto).then((data) => ({ data }));
  }

  @Delete(':name/fields/:fieldName')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete a field from a content type' })
  deleteField(@Param('name') name: string, @Param('fieldName') fieldName: string): Promise<void> {
    return this.service.deleteField(name, fieldName);
  }
}
