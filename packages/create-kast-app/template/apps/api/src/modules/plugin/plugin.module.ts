import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PluginExtensionRegistry } from './plugin-extension.registry';
import { PluginController } from './plugin.controller';
import { PluginLoaderService } from './plugin.loader';
import { PluginRepository } from './plugin.repository';
import { PluginService } from './plugin.service';

@Global()
@Module({
  imports: [PrismaModule],
  controllers: [PluginController],
  providers: [PluginService, PluginRepository, PluginExtensionRegistry, PluginLoaderService],
  exports: [PluginService, PluginLoaderService, PluginExtensionRegistry],
})
export class PluginModule {}
