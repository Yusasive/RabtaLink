import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'ussd_sessions' })
export class UssdSession {
  @PrimaryColumn({ name: 'session_id' })
  sessionId!: string;

  @Column({ name: 'phone_number', type: 'varchar', nullable: true })
  phoneNumber!: string | null;

  @Column({ name: 'current_step', type: 'varchar', nullable: true })
  currentStep!: string | null;

  @Column({ name: 'collected_data', type: 'jsonb', nullable: true })
  collectedData!: Record<string, unknown> | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
