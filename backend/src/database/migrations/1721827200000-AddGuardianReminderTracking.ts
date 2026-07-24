import { MigrationInterface, QueryRunner } from 'typeorm';

// TRD §3's guardians table has no timestamp columns, but PRD §9's 24h auto-reminder
// (M2) needs to know when a consent request was sent and whether a reminder already
// went out. Additive, non-breaking: existing rows backfill created_at to now().
export class AddGuardianReminderTracking1721827200000 implements MigrationInterface {
  name = 'AddGuardianReminderTracking1721827200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "guardians"
      ADD COLUMN "created_at" timestamp NOT NULL DEFAULT now(),
      ADD COLUMN "reminder_sent_at" timestamp NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "guardians"
      DROP COLUMN "reminder_sent_at",
      DROP COLUMN "created_at"
    `);
  }
}
