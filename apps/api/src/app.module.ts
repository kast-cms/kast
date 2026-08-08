import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { validateEnv } from './config/env.schema';
import { AgentTokenModule } from './modules/agent-tokens/agent-token.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { ContentTypesModule } from './modules/content-types/content-types.module';
import { ContentModule } from './modules/content/content.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { DeliveryModule } from './modules/delivery/delivery.module';
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
import { RolesModule } from './modules/roles/roles.module';
import { SearchModule } from './modules/search/search.module';
import { SeoModule } from './modules/seo/seo.module';
import { SettingsModule } from './modules/settings/settings.module';
import { StripeModule } from './modules/stripe/stripe.module';
import { TokensModule } from './modules/tokens/tokens.module';
import { TrashModule } from './modules/trash/trash.module';
import { UsersModule } from './modules/users/users.module';
import { WebhookModule } from './modules/webhook/webhook.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      // Monorepo keeps .env at the repo root; api-only keeps it beside the app.
      // In Docker the env comes from the container, so a missing file is fine.
      envFilePath: ['../../.env', '.env'],
    }),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    // A single global bucket — every named throttler registered here is
    // enforced on EVERY route, so registering the tight `auth` bucket globally
    // would cap the whole API at 20 requests / 15 min per IP. Tighter or looser
    // per-route limits are applied with @Throttle({ default: ... }) on the
    // handler, as described in docs/architecture/KAST_SECURITY_MODEL.md §14.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60000, limit: 100 }]),
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
    UsersModule,
    RolesModule,
    TokensModule,
    DeliveryModule,
  ],
  providers: [
    // Global guard order matters: throttle → jwt auth → roles
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    // Audit logging: records every successful mutating request (CR-02).
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
