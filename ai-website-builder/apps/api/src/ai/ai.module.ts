import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { ImagesService } from './images.service';

@Module({
  providers: [AiService, ImagesService],
  exports: [AiService, ImagesService],
})
export class AiModule {}
