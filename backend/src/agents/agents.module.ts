import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Agent } from '../database/entities/agent.entity';
import { AgentsService } from './agents.service';

// No NotificationsModule import needed: AgentsService sends SMS/Voice via the
// @Global() AfricasTalkingService directly, same pattern as ConsentModule (M2) —
// keeps this a leaf module other feature modules can safely depend on.
@Module({
  imports: [TypeOrmModule.forFeature([Agent])],
  providers: [AgentsService],
  exports: [AgentsService],
})
export class AgentsModule {}
