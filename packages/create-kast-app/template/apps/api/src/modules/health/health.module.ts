import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { SettingsModule } from '../settings/settings.module';
import { HealthController } from './health.controller';

@Module({
  imports: [TerminusModule, SettingsModule],
  controllers: [HealthController],
})
export class HealthModule {}
