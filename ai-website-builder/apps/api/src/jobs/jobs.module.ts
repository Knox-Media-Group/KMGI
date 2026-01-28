import { Module, forwardRef } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { JobsController } from './jobs.controller';
import { JobsProcessor } from './jobs.processor';
import { AuthModule } from '../auth/auth.module';
import { WordPressModule } from '../wordpress/wordpress.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [
    AuthModule,
    forwardRef(() => WordPressModule),
    forwardRef(() => AiModule),
  ],
  controllers: [JobsController],
  providers: [JobsService, JobsProcessor],
  exports: [JobsService],
})
export class JobsModule {}
