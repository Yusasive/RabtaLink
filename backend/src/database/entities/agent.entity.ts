import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'agents' })
export class Agent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'phone_number', unique: true })
  phoneNumber!: string;

  @Column({ type: 'varchar', nullable: true })
  name!: string | null;

  @Column({ name: 'coverage_lga', type: 'varchar', nullable: true })
  coverageLga!: string | null;

  @Column({ type: 'boolean', default: false })
  verified!: boolean;

  @Column({ name: 'total_rewards_earned', type: 'int', default: 0 })
  totalRewardsEarned!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
