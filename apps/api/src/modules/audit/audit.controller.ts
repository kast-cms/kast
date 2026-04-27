import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuditLog } from '@prisma/client';
import type { Response } from 'express';
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

  @Get('export')
  @ApiOperation({ summary: 'Export audit logs as CSV (max 5 000 rows)' })
  async exportCsv(@Query() query: AuditQueryDto, @Res() res: Response): Promise<void> {
    const csv = await this.auditService.exportCsv(query);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="audit-export.csv"');
    res.send(csv);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get audit log by ID' })
  findOne(@Param('id') id: string): Promise<{ data: AuditLog }> {
    return this.auditService.findById(id).then((data) => ({ data }));
  }
}
