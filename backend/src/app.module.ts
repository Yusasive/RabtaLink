import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import configuration from './config/configuration';
import { envValidationSchema } from './config/env-validation.schema';
import { AfricasTalkingModule } from './africastalking/africastalking.module';
import { ActivityModule } from './activity/activity.module';
import { AgentsModule } from './agents/agents.module';
import { AuthModule } from './auth/auth.module';
import { ConsentModule } from './consent/consent.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health/health.controller';
import { LedgerModule } from './ledger/ledger.module';
import { MatchingModule } from './matching/matching.module';
import { NotificationsModule } from './notifications/notifications.module';
import { RedisModule } from './redis/redis.module';
import { UssdModule } from './ussd/ussd.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema: envValidationSchema,
      validationOptions: { abortEarly: false },
    }),
    // Generous global default (protects the JSON API from generic abuse); the
    // AT-facing webhook controllers opt out via @SkipThrottle() since AT's own
    // call bursts aren't predictable and are already gated by AtWebhookGuard
    // instead. Auth's OTP endpoints override this with much stricter limits.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 100 }]),
    ScheduleModule.forRoot(),
    DatabaseModule,
    RedisModule,
    ActivityModule,
    AfricasTalkingModule,
    ConsentModule,
    AgentsModule,
    UssdModule,
    NotificationsModule,
    LedgerModule,
    MatchingModule,
    AuthModule,
    DashboardModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
