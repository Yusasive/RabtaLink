import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type AirtimeSenderType = 'user' | 'system';
export type AirtimeRecipientType = 'user' | 'agent';
export type AirtimeReason = 'courting_gesture' | 'agent_reward';

@Entity({ name: 'airtime_transactions' })
export class AirtimeTransaction {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'sender_type', type: 'varchar' })
  senderType!: AirtimeSenderType;

  @Column({ name: 'sender_id', type: 'uuid', nullable: true })
  senderId!: string | null;

  @Column({ name: 'recipient_id', type: 'uuid' })
  recipientId!: string;

  @Column({ name: 'recipient_type', type: 'varchar' })
  recipientType!: AirtimeRecipientType;

  @Column({ type: 'int' })
  amount!: number;

  @Column({ type: 'varchar' })
  reason!: AirtimeReason;

  @Column({ name: 'at_transaction_id', type: 'varchar', nullable: true })
  atTransactionId!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
