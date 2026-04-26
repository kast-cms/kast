import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PluginController } from './plugin.controller';
import { PluginLoaderService } from './plugin.loader';
import { PluginRepository } from './plugin.repository';
import { PluginService } from './plugin.service';

@Module({
  imports: [PrismaModule],
  controllers: [PluginController],
  providers: [PluginService, PluginRepository, PluginLoaderService],
  exports: [PluginService, PluginLoaderService],
})
export class PluginModule {}
