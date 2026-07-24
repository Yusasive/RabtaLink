import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentsModule } from '../agents/agents.module';
import { ConsentModule } from '../consent/consent.module';
import { User } from '../database/entities/user.entity';
import { MatchingModule } from '../matching/matching.module';
import { SmsController } from './sms.controller';
import { SmsService } from './sms.service';
import { VoiceController } from './voice.controller';
import { VoiceService } from './voice.service';

@Module({
  imports: [TypeOrmModule.forFeature([User]), ConsentModule, AgentsModule, MatchingModule],
  controllers: [SmsController, VoiceController],
  providers: [SmsService, VoiceService],
  exports: [SmsService, VoiceService],
})
export class NotificationsModule {}
