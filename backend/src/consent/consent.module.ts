import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Guardian } from '../database/entities/guardian.entity';
import { User } from '../database/entities/user.entity';
import { ConsentController } from './consent.controller';
import { ConsentService } from './consent.service';

// No NotificationsModule import: ConsentService sends SMS via the @Global()
// AfricasTalkingService directly, so this stays a one-way dependency for whoever
// needs ConsentService (avoids a NotificationsModule <-> ConsentModule import cycle).
@Module({
  imports: [TypeOrmModule.forFeature([Guardian, User])],
  controllers: [ConsentController],
  providers: [ConsentService],
  exports: [ConsentService],
})
export class ConsentModule {}
