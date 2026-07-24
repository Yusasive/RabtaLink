import { MigrationInterface, QueryRunner } from 'typeorm';

// Schema matches TRD.md §3 exactly. guardians.linked_user_id and users.guardian_id reference
// each other, so guardians is created first without its FK, users is created referencing
// guardians, and the guardians -> users FK is added afterward via ALTER TABLE.
export class InitialSchema1721740800000 implements MigrationInterface {
  name = 'InitialSchema1721740800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

    await queryRunner.query(`
      CREATE TABLE "guardians" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "phone_number" varchar NOT NULL,
        "linked_user_id" uuid NULL,
        "consent_response" varchar NULL,
        "responded_at" timestamp NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "phone_number" varchar NOT NULL UNIQUE,
        "name" varchar NULL,
        "age_bracket" varchar NULL,
        "lga" varchar NULL,
        "language" varchar NOT NULL DEFAULT 'ha',
        "intent_type" varchar NOT NULL,
        "interest_tags" text[] NULL,
        "guardian_id" uuid NULL REFERENCES "guardians"("id"),
        "consent_status" varchar NOT NULL DEFAULT 'not_required',
        "voice_intro_url" text NULL,
        "status" varchar NOT NULL DEFAULT 'active',
        "created_at" timestamp NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "guardians"
      ADD CONSTRAINT "fk_guardians_linked_user_id"
      FOREIGN KEY ("linked_user_id") REFERENCES "users"("id")
    `);

    await queryRunner.query(`
      CREATE TABLE "agents" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "phone_number" varchar NOT NULL UNIQUE,
        "name" varchar NULL,
        "coverage_lga" varchar NULL,
        "verified" boolean NOT NULL DEFAULT false,
        "total_rewards_earned" int NOT NULL DEFAULT 0,
        "created_at" timestamp NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "matches" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_a_id" uuid NOT NULL REFERENCES "users"("id"),
        "user_b_id" uuid NOT NULL REFERENCES "users"("id"),
        "proposed_by_agent_id" uuid NULL REFERENCES "agents"("id"),
        "status" varchar NOT NULL DEFAULT 'proposed',
        "guardian_included" boolean NOT NULL DEFAULT false,
        "scheduled_call_time" timestamp NULL,
        "call_completed" boolean NOT NULL DEFAULT false,
        "reward_issued" boolean NOT NULL DEFAULT false,
        "created_at" timestamp NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "airtime_transactions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "sender_type" varchar NOT NULL,
        "sender_id" uuid NULL,
        "recipient_id" uuid NOT NULL,
        "recipient_type" varchar NOT NULL,
        "amount" int NOT NULL,
        "reason" varchar NOT NULL,
        "at_transaction_id" varchar NULL,
        "created_at" timestamp NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "ussd_sessions" (
        "session_id" varchar PRIMARY KEY,
        "phone_number" varchar NULL,
        "current_step" varchar NULL,
        "collected_data" jsonb NULL,
        "updated_at" timestamp NOT NULL DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "ussd_sessions"`);
    await queryRunner.query(`DROP TABLE "airtime_transactions"`);
    await queryRunner.query(`DROP TABLE "matches"`);
    await queryRunner.query(`DROP TABLE "agents"`);
    await queryRunner.query(`ALTER TABLE "guardians" DROP CONSTRAINT "fk_guardians_linked_user_id"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TABLE "guardians"`);
  }
}
