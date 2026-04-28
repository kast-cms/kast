import { Module } from '@nestjs/common';
import { ContentTypesController } from './content-types.controller';
import { ContentTypesRepository } from './content-types.repository';
import { ContentTypesService } from './content-types.service';

@Module({
  controllers: [ContentTypesController],
  providers: [ContentTypesService, ContentTypesRepository],
  exports: [ContentTypesService, ContentTypesRepository],
})
export class ContentTypesModule {}
