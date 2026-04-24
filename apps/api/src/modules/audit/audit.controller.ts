import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuditLog } from '@prisma/client';
import { SYSTEM_ROLES } from '../../common/constants/roles.constants';
import { Roles } from '../../common/decorators/roles.decorator';
import type { PaginatedResult } from '../../common/types/auth.types';
import { AuditService } from './audit.service';
import { AuditQueryDto } from './dto/audit-query.dto';

@ApiTags('audit')
@ApiBearerAuth()
@Roles(SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
@Controller({ path: 'audit', version: '1' })
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'List audit logs' })
  findAll(@Query() query: AuditQueryDto): Promise<PaginatedResult<AuditLog>> {
    return this.auditService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get audit log by ID' })
  findOne(@Param('id') id: string): Promise<{ data: AuditLog }> {
    return this.auditService.findById(id).then((data) => ({ data }));
  }
}
