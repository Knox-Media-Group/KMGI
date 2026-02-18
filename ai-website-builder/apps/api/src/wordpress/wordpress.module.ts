import { Module } from '@nestjs/common';
import { WordPressService } from './wordpress.service';
import { StylesService } from './styles.service';
import { EcommerceController } from './ecommerce.controller';
import { StagingController } from './staging.controller';

@Module({
  controllers: [EcommerceController, StagingController],
  providers: [WordPressService, StylesService],
  exports: [WordPressService, StylesService],
})
export class WordPressModule {}
