import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SYSTEM_ROLES } from '../../common/constants/roles.constants';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  DashboardService,
  type ActivityEntry,
  type DashboardStats,
  type QueueHealthEntry,
} from './dashboard.service';

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller({ path: 'dashboard', version: '1' })
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @Roles(SYSTEM_ROLES.EDITOR, SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get dashboard statistics' })
  getStats(): Promise<DashboardStats> {
    return this.dashboardService.getStats();
  }

  @Get('activity')
  @Roles(SYSTEM_ROLES.EDITOR, SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get recent activity (last 20 audit events)' })
  getActivity(): Promise<ActivityEntry[]> {
    return this.dashboardService.getActivity();
  }

  @Get('queue-health')
  @Roles(SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get queue health metrics (admin only)' })
  getQueueHealth(): Promise<QueueHealthEntry[]> {
    return this.dashboardService.getQueueHealth();
  }
}
