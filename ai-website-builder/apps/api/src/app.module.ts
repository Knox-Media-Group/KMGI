import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { SitesModule } from './sites/sites.module';
import { BillingModule } from './billing/billing.module';
import { JobsModule } from './jobs/jobs.module';
import { TenantsModule } from './tenants/tenants.module';
import { WordPressModule } from './wordpress/wordpress.module';
import { AiModule } from './ai/ai.module';
import { PerformanceModule } from './performance/performance.module';
import { ApiModule } from './api/api.module';
import { HostingModule } from './hosting/hosting.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { HealthController } from './health.controller';

@Module({
  controllers: [HealthController],
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    AuthModule,
    TenantsModule,
    SitesModule,
    BillingModule,
    JobsModule,
    WordPressModule,
    AiModule,
    PerformanceModule,
    ApiModule,
    HostingModule,
    AnalyticsModule,
  ],
})
export class AppModule {}
