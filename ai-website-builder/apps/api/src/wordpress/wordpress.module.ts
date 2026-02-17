import { Module } from '@nestjs/common';
import { WordPressService } from './wordpress.service';
import { StylesService } from './styles.service';

@Module({
  providers: [WordPressService, StylesService],
  exports: [WordPressService, StylesService],
})
export class WordPressModule {}
