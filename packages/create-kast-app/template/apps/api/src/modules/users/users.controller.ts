import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SYSTEM_ROLES } from '../../common/constants/roles.constants';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthUser, PaginatedResult } from '../../common/types/auth.types';
import {
  InviteUserDto,
  UpdateUserDto,
  UserListQueryDto,
  type UserSummaryResponse,
} from './dto/user.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Roles(SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'List admin users' })
  list(@Query() query: UserListQueryDto): Promise<PaginatedResult<UserSummaryResponse>> {
    return this.service.findAll(query);
  }

  @Post()
  @ApiOperation({ summary: 'Invite a new admin user' })
  invite(
    @Body() dto: InviteUserDto,
    @CurrentUser() user: AuthUser,
  ): Promise<{ data: UserSummaryResponse }> {
    return this.service.invite(dto, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a user' })
  findOne(@Param('id') id: string): Promise<{ data: UserSummaryResponse }> {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a user' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: AuthUser,
  ): Promise<{ data: UserSummaryResponse }> {
    return this.service.update(id, dto, user);
  }

  @Post(':id/invite')
  @ApiOperation({ summary: 'Re-send the invitation email with a fresh token' })
  resendInvite(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<{ data: { id: string } }> {
    return this.service.resendInvite(id, user);
  }

  @Delete(':id/invite')
  @ApiOperation({ summary: 'Revoke a pending invitation token' })
  revokeInvite(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<{ data: { id: string } }> {
    return this.service.revokeInvite(id, user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Move a user to trash' })
  remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<{ data: { id: string; trashedAt: string } }> {
    return this.service.trash(id, user);
  }
}
