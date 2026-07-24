import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from './user.entity';

export type ConsentResponse = 'yes' | 'no';

@Entity({ name: 'guardians' })
export class Guardian {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'phone_number' })
  phoneNumber!: string;

  @Column({ name: 'linked_user_id', type: 'uuid', nullable: true })
  linkedUserId!: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'linked_user_id' })
  linkedUser?: User;

  @Column({ name: 'consent_response', type: 'varchar', nullable: true })
  consentResponse!: ConsentResponse | null;

  @Column({ name: 'responded_at', type: 'timestamp', nullable: true })
  respondedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @Column({ name: 'reminder_sent_at', type: 'timestamp', nullable: true })
  reminderSentAt!: Date | null;
}
