import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Guardian } from './guardian.entity';

export type IntentType = 'marriage' | 'friendship' | 'professional';
export type ConsentStatus = 'pending' | 'approved' | 'declined' | 'not_required';
export type UserStatus = 'active' | 'pending_consent' | 'paused';
export type Language = 'ha' | 'en';

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'phone_number', unique: true })
  phoneNumber!: string;

  @Column({ type: 'varchar', nullable: true })
  name!: string | null;

  @Column({ name: 'age_bracket', type: 'varchar', nullable: true })
  ageBracket!: string | null;

  @Column({ type: 'varchar', nullable: true })
  lga!: string | null;

  @Column({ type: 'varchar', default: 'ha' })
  language!: Language;

  @Column({ name: 'intent_type' })
  intentType!: IntentType;

  @Column({ name: 'interest_tags', type: 'text', array: true, nullable: true })
  interestTags!: string[] | null;

  @Column({ name: 'guardian_id', type: 'uuid', nullable: true })
  guardianId!: string | null;

  @ManyToOne(() => Guardian, { nullable: true })
  @JoinColumn({ name: 'guardian_id' })
  guardian?: Guardian;

  @Column({ name: 'consent_status', type: 'varchar', default: 'not_required' })
  consentStatus!: ConsentStatus;

  @Column({ name: 'voice_intro_url', type: 'text', nullable: true })
  voiceIntroUrl!: string | null;

  @Column({ type: 'varchar', default: 'active' })
  status!: UserStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
