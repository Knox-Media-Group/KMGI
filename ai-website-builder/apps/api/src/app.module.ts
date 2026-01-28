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

@Module({
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
  ],
})
export class AppModule {}
