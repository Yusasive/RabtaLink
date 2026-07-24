import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Guardian } from '../database/entities/guardian.entity';
import { Match } from '../database/entities/match.entity';
import { User } from '../database/entities/user.entity';
import { MatchingController } from './matching.controller';
import { MatchingService } from './matching.service';

// No NotificationsModule import: MatchingService sends SMS/Voice via the
// @Global() AfricasTalkingService directly, same pattern as ConsentModule/AgentsModule.
@Module({
  imports: [TypeOrmModule.forFeature([Match, User, Guardian])],
  controllers: [MatchingController],
  providers: [MatchingService],
  exports: [MatchingService],
})
export class MatchingModule {}
