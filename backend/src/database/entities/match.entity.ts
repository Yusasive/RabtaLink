import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Agent } from './agent.entity';
import { User } from './user.entity';

export type MatchStatus =
  | 'proposed'
  | 'accepted_a'
  | 'accepted_b'
  | 'both_accepted'
  | 'call_scheduled'
  | 'completed'
  | 'declined';

@Entity({ name: 'matches' })
export class Match {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_a_id', type: 'uuid' })
  userAId!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_a_id' })
  userA?: User;

  @Column({ name: 'user_b_id', type: 'uuid' })
  userBId!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_b_id' })
  userB?: User;

  @Column({ name: 'proposed_by_agent_id', type: 'uuid', nullable: true })
  proposedByAgentId!: string | null;

  @ManyToOne(() => Agent, { nullable: true })
  @JoinColumn({ name: 'proposed_by_agent_id' })
  proposedByAgent?: Agent;

  @Column({ type: 'varchar', default: 'proposed' })
  status!: MatchStatus;

  @Column({ name: 'guardian_included', type: 'boolean', default: false })
  guardianIncluded!: boolean;

  @Column({ name: 'scheduled_call_time', type: 'timestamp', nullable: true })
  scheduledCallTime!: Date | null;

  @Column({ name: 'call_completed', type: 'boolean', default: false })
  callCompleted!: boolean;

  @Column({ name: 'reward_issued', type: 'boolean', default: false })
  rewardIssued!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
