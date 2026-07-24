import 'dotenv/config';
import 'reflect-metadata';
import { AppDataSource } from './data-source';
import { Agent } from './entities/agent.entity';
import { Guardian } from './entities/guardian.entity';
import { User } from './entities/user.entity';

/**
 * M9/TRD §7: seeds a verified agent + "a handful" of demo registrants so a live
 * demo can skip registration/consent's real-time round trips and jump straight
 * to match proposal → voice bridge → airtime reward. Reuses PRD §3's own persona
 * names (Amina, Bashir, Hajiya Zainab) for narrative continuity with the pitch.
 *
 * Deviates from TRD §7's literal "one guardian" in one respect: the flagship
 * demo pair (Amina + Bashir) are both marriage-intent, and M1's own registration
 * flow makes a guardian mandatory for every marriage-intent registrant — so a
 * realistic, propose-able marriage match needs two guardians, not one. Seeding
 * only one would mean faking a state the live product can never actually reach.
 *
 * Safe to re-run: deletes and recreates rows by these fixed seed phone numbers only.
 */
const AGENT_PHONE = '+234700000001';
const AMINA_PHONE = '+234700000002';
const AMINA_GUARDIAN_PHONE = '+234700000003';
const BASHIR_PHONE = '+234700000004';
const BASHIR_GUARDIAN_PHONE = '+234700000005';
const SADIQ_PHONE = '+234700000006';
const HAUWA_PHONE = '+234700000007';

const DEMO_LGA = 'Kano Municipal';

async function seed() {
  await AppDataSource.initialize();
  const userRepo = AppDataSource.getRepository(User);
  const guardianRepo = AppDataSource.getRepository(Guardian);
  const agentRepo = AppDataSource.getRepository(Agent);

  console.log('Clearing any existing seed rows...');
  const seedUserPhones = [AMINA_PHONE, BASHIR_PHONE, SADIQ_PHONE, HAUWA_PHONE];
  const existingUsers = await userRepo.find({ where: seedUserPhones.map((phoneNumber) => ({ phoneNumber })) });
  if (existingUsers.length > 0) {
    await userRepo.update(
      existingUsers.map((u) => u.id),
      { guardianId: null },
    );
  }
  await guardianRepo.delete({ phoneNumber: AMINA_GUARDIAN_PHONE });
  await guardianRepo.delete({ phoneNumber: BASHIR_GUARDIAN_PHONE });
  await userRepo.delete(seedUserPhones.map((phoneNumber) => ({ phoneNumber })));
  await agentRepo.delete({ phoneNumber: AGENT_PHONE });

  console.log('Seeding agent...');
  const agent = await agentRepo.save(
    agentRepo.create({
      phoneNumber: AGENT_PHONE,
      name: 'Hajiya Zainab',
      coverageLga: DEMO_LGA,
      verified: true,
    }),
  );

  console.log('Seeding Amina (marriage, guardian-approved)...');
  let amina = await userRepo.save(
    userRepo.create({
      phoneNumber: AMINA_PHONE,
      name: 'Amina',
      ageBracket: '25-30',
      lga: DEMO_LGA,
      language: 'ha',
      intentType: 'marriage',
      interestTags: ['religion', 'business'],
      consentStatus: 'approved',
      status: 'active',
    }),
  );
  const aminaGuardian = await guardianRepo.save(
    guardianRepo.create({
      phoneNumber: AMINA_GUARDIAN_PHONE,
      linkedUserId: amina.id,
      consentResponse: 'yes',
      respondedAt: new Date(),
    }),
  );
  amina = await userRepo.save({ ...amina, guardianId: aminaGuardian.id });

  console.log('Seeding Bashir (marriage, guardian-approved)...');
  let bashir = await userRepo.save(
    userRepo.create({
      phoneNumber: BASHIR_PHONE,
      name: 'Bashir',
      ageBracket: '31-35',
      lga: DEMO_LGA,
      language: 'ha',
      intentType: 'marriage',
      interestTags: ['business', 'education'],
      consentStatus: 'approved',
      status: 'active',
    }),
  );
  const bashirGuardian = await guardianRepo.save(
    guardianRepo.create({
      phoneNumber: BASHIR_GUARDIAN_PHONE,
      linkedUserId: bashir.id,
      consentResponse: 'yes',
      respondedAt: new Date(),
    }),
  );
  bashir = await userRepo.save({ ...bashir, guardianId: bashirGuardian.id });

  console.log('Seeding Sadiq (professional) and Hauwa (friendship) for variety...');
  await userRepo.save(
    userRepo.create({
      phoneNumber: SADIQ_PHONE,
      name: 'Sadiq',
      ageBracket: '18-24',
      lga: DEMO_LGA,
      language: 'en',
      intentType: 'professional',
      interestTags: ['education'],
      consentStatus: 'not_required',
      status: 'active',
    }),
  );
  await userRepo.save(
    userRepo.create({
      phoneNumber: HAUWA_PHONE,
      name: 'Hauwa',
      ageBracket: '25-30',
      lga: DEMO_LGA,
      language: 'ha',
      intentType: 'friendship',
      interestTags: ['sports', 'cooking'],
      consentStatus: 'not_required',
      status: 'active',
    }),
  );

  console.log('\nSeed complete:');
  console.log(`  Agent:  ${agent.name} (${agent.phoneNumber}) — verified, covers ${agent.coverageLga}`);
  console.log(`  Amina:  ${amina.phoneNumber} — marriage, guardian ${aminaGuardian.phoneNumber} approved`);
  console.log(`  Bashir: ${bashir.phoneNumber} — marriage, guardian ${bashirGuardian.phoneNumber} approved`);
  console.log(`  Sadiq:  ${SADIQ_PHONE} — professional`);
  console.log(`  Hauwa:  ${HAUWA_PHONE} — friendship`);
  console.log('\nLive demo: log the agent into the dashboard, then propose Amina + Bashir live.');

  await AppDataSource.destroy();
}

seed().catch((err: unknown) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
