import { Module } from '@nestjs/common';
import { AgentsModule } from '../agents/agents.module';
import { ConsentModule } from '../consent/consent.module';
import { LedgerModule } from '../ledger/ledger.module';
import { MatchingModule } from '../matching/matching.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UssdController } from './ussd.controller';
import { UssdService } from './ussd.service';
import { UssdSessionStore } from './ussd-session.store';

@Module({
  imports: [NotificationsModule, ConsentModule, AgentsModule, MatchingModule, LedgerModule],
  controllers: [UssdController],
  providers: [UssdService, UssdSessionStore],
})
export class UssdModule {}
