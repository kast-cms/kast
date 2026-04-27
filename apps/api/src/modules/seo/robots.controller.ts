import { Controller, Get, Header } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';

const DEFAULT_ROBOTS = `User-agent: *\nAllow: /\n`;

@ApiTags('seo')
@Controller({ path: 'robots.txt', version: '1' })
export class RobotsController {
  @Get()
  @Public()
  @Header('Content-Type', 'text/plain')
  @ApiOperation({ summary: 'Serve robots.txt' })
  getRobots(): string {
    return DEFAULT_ROBOTS;
  }
}
