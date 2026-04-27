import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { validateEnv } from './config/env.schema';
import { AgentTokenModule } from './modules/agent-tokens/agent-token.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { ContentTypesModule } from './modules/content-types/content-types.module';
import { ContentModule } from './modules/content/content.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { EmailModule } from './modules/email/email.module';
import { FormModule } from './modules/forms/form.module';
import { HealthModule } from './modules/health/health.module';
import { LocalesModule } from './modules/locales/locales.module';
import { McpModule } from './modules/mcp/mcp.module';
import { MediaModule } from './modules/media/media.module';
import { MenuModule } from './modules/menus/menu.module';
import { PluginModule } from './modules/plugin/plugin.module';
import { PublishModule } from './modules/publish/publish.module';
import { QueueBoardModule } from './modules/queue/queue-board.module';
import { QueueModule } from './modules/queue/queue.module';
import { SearchModule } from './modules/search/search.module';
import { SeoModule } from './modules/seo/seo.module';
import { SettingsModule } from './modules/settings/settings.module';
import { StripeModule } from './modules/stripe/stripe.module';
import { TrashModule } from './modules/trash/trash.module';
import { WebhookModule } from './modules/webhook/webhook.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    ThrottlerModule.forRoot([
      { name: 'public', ttl: 60000, limit: 100 },
      { name: 'auth', ttl: 900000, limit: 20 },
      { name: 'admin', ttl: 60000, limit: 300 },
      { name: 'apiKey', ttl: 60000, limit: 1000 },
    ]),
    PrismaModule,
    QueueModule,
    HealthModule,
    AuthModule,
    AuditModule,
    ContentTypesModule,
    ContentModule,
    MediaModule,
    SeoModule,
    McpModule,
    LocalesModule,
    PublishModule,
    TrashModule,
    EmailModule,
    SettingsModule,
    WebhookModule,
    AgentTokenModule,
    PluginModule,
    FormModule,
    MenuModule,
    DashboardModule,
    QueueBoardModule,
    SearchModule,
    StripeModule,
  ],
})
export class AppModule {}
