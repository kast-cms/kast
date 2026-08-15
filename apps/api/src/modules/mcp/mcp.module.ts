import { Module } from '@nestjs/common';
import { AgentTokenModule } from '../agent-tokens/agent-token.module';
import { AuditModule } from '../audit/audit.module';
import { ContentTypesModule } from '../content-types/content-types.module';
import { ContentModule } from '../content/content.module';
import { MediaModule } from '../media/media.module';
import { PluginModule } from '../plugin/plugin.module';
import { SeoModule } from '../seo/seo.module';
import { UsersModule } from '../users/users.module';
import { McpController } from './mcp.controller';
import { McpRegistry } from './mcp.registry';
import { McpService } from './mcp.service';
import { McpContentEntryTools } from './tools/content-entry.tools';
import { McpContentTypeTools } from './tools/content-type.tools';
import { McpMediaSeoAuditTools } from './tools/media-seo-audit.tools';
import { McpPlatformTools } from './tools/platform.tools';

@Module({
  imports: [
    ContentTypesModule,
    ContentModule,
    MediaModule,
    SeoModule,
    AuditModule,
    AgentTokenModule,
    PluginModule,
    UsersModule,
  ],
  controllers: [McpController],
  providers: [
    McpService,
    McpRegistry,
    McpContentTypeTools,
    McpContentEntryTools,
    McpMediaSeoAuditTools,
    McpPlatformTools,
  ],
})
export class McpModule {}
