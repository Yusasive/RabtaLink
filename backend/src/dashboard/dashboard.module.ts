import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentsModule } from '../agents/agents.module';
import { AuthModule } from '../auth/auth.module';
import { Agent } from '../database/entities/agent.entity';
import { AirtimeTransaction } from '../database/entities/airtime-transaction.entity';
import { Match } from '../database/entities/match.entity';
import { User } from '../database/entities/user.entity';
import { MatchingModule } from '../matching/matching.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Match, Agent, AirtimeTransaction]),
    AgentsModule,
    MatchingModule,
    AuthModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
