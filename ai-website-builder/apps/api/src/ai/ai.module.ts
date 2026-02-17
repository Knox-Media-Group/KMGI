import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { ImagesService } from './images.service';

@Module({
  controllers: [AiController],
  providers: [AiService, ImagesService],
  exports: [AiService, ImagesService],
})
export class AiModule {}
