import { Repository } from 'typeorm';
import { AfricasTalkingService } from '../africastalking/africastalking.service';
import { Guardian } from '../database/entities/guardian.entity';
import { Match } from '../database/entities/match.entity';
import { User } from '../database/entities/user.entity';
import { RedisService } from '../redis/redis.service';
import { MatchingService } from './matching.service';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-a',
    phoneNumber: '+2340000000001',
    name: 'Test User',
    ageBracket: '25-30',
    lga: 'Kano Municipal',
    language: 'ha',
    intentType: 'friendship',
    interestTags: [],
    guardianId: null,
    consentStatus: 'not_required',
    voiceIntroUrl: null,
    status: 'active',
    createdAt: new Date(),
    ...overrides,
  };
}

describe('MatchingService.evaluateProposal (eligibility)', () => {
  let matchRepo: { findOne: jest.Mock };
  let userRepo: { findOne: jest.Mock };
  let guardianRepo: { find: jest.Mock };
  let africasTalking: Partial<AfricasTalkingService>;
  let redis: Partial<RedisService>;
  let service: MatchingService;

  beforeEach(() => {
    matchRepo = { findOne: jest.fn() };
    userRepo = { findOne: jest.fn() };
    guardianRepo = { find: jest.fn() };
    africasTalking = { sendSms: jest.fn(), makeCall: jest.fn(), sendAirtime: jest.fn() };
    redis = { get: jest.fn(), set: jest.fn(), del: jest.fn() };
    service = new MatchingService(
      matchRepo as unknown as Repository<Match>,
      userRepo as unknown as Repository<User>,
      guardianRepo as unknown as Repository<Guardian>,
      africasTalking as AfricasTalkingService,
      redis as RedisService,
    );
  });

  it('rejects when either phone number is not registered', async () => {
    userRepo.findOne.mockResolvedValueOnce(makeUser()).mockResolvedValueOnce(null);
    const result = await service.evaluateProposal('+2340000000001', '+2340000000002');
    expect(result).toEqual({ ok: false, reason: 'not_found' });
  });

  it('rejects matching a person to themselves', async () => {
    const user = makeUser();
    userRepo.findOne.mockResolvedValue(user);
    const result = await service.evaluateProposal(user.phoneNumber, user.phoneNumber);
    expect(result).toEqual({ ok: false, reason: 'ineligible' });
  });

  it('rejects when intent types differ', async () => {
    const userA = makeUser({ id: 'a', intentType: 'friendship' });
    const userB = makeUser({ id: 'b', intentType: 'professional' });
    userRepo.findOne.mockResolvedValueOnce(userA).mockResolvedValueOnce(userB);
    const result = await service.evaluateProposal(userA.phoneNumber, userB.phoneNumber);
    expect(result).toEqual({ ok: false, reason: 'ineligible' });
  });

  it('rejects when either party is not active (e.g. still pending guardian consent)', async () => {
    const userA = makeUser({ id: 'a', status: 'active' });
    const userB = makeUser({ id: 'b', status: 'pending_consent' });
    userRepo.findOne.mockResolvedValueOnce(userA).mockResolvedValueOnce(userB);
    const result = await service.evaluateProposal(userA.phoneNumber, userB.phoneNumber);
    expect(result).toEqual({ ok: false, reason: 'ineligible' });
  });

  it('rejects when LGA differs even after normalization', async () => {
    const userA = makeUser({ id: 'a', lga: 'Kano Municipal' });
    const userB = makeUser({ id: 'b', lga: 'Dala' });
    userRepo.findOne.mockResolvedValueOnce(userA).mockResolvedValueOnce(userB);
    const result = await service.evaluateProposal(userA.phoneNumber, userB.phoneNumber);
    expect(result).toEqual({ ok: false, reason: 'ineligible' });
  });

  it('accepts LGA differing only by case/whitespace (regression test for the normalization fix)', async () => {
    const userA = makeUser({ id: 'a', lga: 'Kano Municipal' });
    const userB = makeUser({ id: 'b', lga: '  kano   municipal ' });
    userRepo.findOne.mockResolvedValueOnce(userA).mockResolvedValueOnce(userB);
    matchRepo.findOne.mockResolvedValueOnce(null);
    const result = await service.evaluateProposal(userA.phoneNumber, userB.phoneNumber);
    expect(result.ok).toBe(true);
  });

  it('rejects when an unresolved match between the pair already exists', async () => {
    const userA = makeUser({ id: 'a' });
    const userB = makeUser({ id: 'b' });
    userRepo.findOne.mockResolvedValueOnce(userA).mockResolvedValueOnce(userB);
    matchRepo.findOne.mockResolvedValueOnce({ id: 'existing-match' });
    const result = await service.evaluateProposal(userA.phoneNumber, userB.phoneNumber);
    expect(result).toEqual({ ok: false, reason: 'ineligible' });
  });

  it('produces a plain-language summary, never a raw score, on success', async () => {
    const userA = makeUser({ id: 'a', ageBracket: '25-30', interestTags: ['religion', 'business'] });
    const userB = makeUser({ id: 'b', ageBracket: '31-35', interestTags: ['business', 'education'] });
    userRepo.findOne.mockResolvedValueOnce(userA).mockResolvedValueOnce(userB);
    matchRepo.findOne.mockResolvedValueOnce(null);
    const result = await service.evaluateProposal(userA.phoneNumber, userB.phoneNumber);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.summary).toContain('LGA:');
      expect(result.summary).toContain('25-30/31-35');
      expect(result.summary).toContain("Sha'awa iri daya: 1"); // one shared tag: "business"
      expect(result.summary).not.toMatch(/\bscore\b/i);
    }
  });
});
