import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Agent } from '../database/entities/agent.entity';
import { AirtimeTransaction } from '../database/entities/airtime-transaction.entity';
import { Match } from '../database/entities/match.entity';
import { AirtimeController } from './airtime.controller';
import { AirtimeService } from './airtime.service';

@Module({
  imports: [TypeOrmModule.forFeature([AirtimeTransaction, Match, Agent])],
  controllers: [AirtimeController],
  providers: [AirtimeService],
  exports: [AirtimeService],
})
export class LedgerModule {}
