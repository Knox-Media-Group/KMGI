import { Module } from '@nestjs/common';
import { BillingController, StripeWebhookController } from './billing.controller';
import { BillingService } from './billing.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [BillingController, StripeWebhookController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
