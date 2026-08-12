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
import { SYSTEM_ROLES } from '../../common/constants/roles.constants';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthUser, PaginatedResult } from '../../common/types/auth.types';
import {
  AssignPermissionsDto,
  CreateRoleDto,
  type RoleDetailResponse,
  type RoleSummaryResponse,
  UpdateRoleDto,
} from './dto/role.dto';
import { RolesService } from './roles.service';

@ApiTags('roles')
@ApiBearerAuth()
@Controller({ path: 'roles', version: '1' })
export class RolesController {
  constructor(private readonly service: RolesService) {}

  @Get()
  @Roles(SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'List all roles' })
  list(): Promise<PaginatedResult<RoleSummaryResponse>> {
    return this.service.findAll();
  }

  @Post()
  @Roles(SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a custom role' })
  create(@Body() dto: CreateRoleDto): Promise<{ data: RoleSummaryResponse }> {
    return this.service.create(dto);
  }

  @Get(':id')
  @Roles(SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get a role with its permissions' })
  findOne(@Param('id') id: string): Promise<{ data: RoleDetailResponse }> {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @Roles(SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update a custom role' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
  ): Promise<{ data: RoleSummaryResponse }> {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles(SYSTEM_ROLES.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a custom role' })
  async delete(@Param('id') id: string): Promise<void> {
    await this.service.delete(id);
  }

  @Post(':id/permissions')
  @Roles(SYSTEM_ROLES.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Replace a role's permissions" })
  assignPermissions(
    @Param('id') id: string,
    @Body() dto: AssignPermissionsDto,
    @CurrentUser() user: AuthUser,
  ): Promise<{ data: RoleDetailResponse }> {
    return this.service.assignPermissions(id, dto, user);
  }

  @Delete(':id/permissions/:permissionId')
  @Roles(SYSTEM_ROLES.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a permission from a role' })
  async removePermission(
    @Param('id') id: string,
    @Param('permissionId') permissionId: string,
  ): Promise<void> {
    await this.service.removePermission(id, permissionId);
  }
}
