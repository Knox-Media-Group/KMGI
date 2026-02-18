import { Module } from '@nestjs/common';
import { HostingService } from './hosting.service';
import { HostingController } from './hosting.controller';

@Module({
  controllers: [HostingController],
  providers: [HostingService],
  exports: [HostingService],
})
export class HostingModule {}
