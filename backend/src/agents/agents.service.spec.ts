import { Repository } from 'typeorm';
import { AfricasTalkingService } from '../africastalking/africastalking.service';
import { Agent } from '../database/entities/agent.entity';
import { AgentsService } from './agents.service';

function makeAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: 'agent-1',
    phoneNumber: '+2340000009999',
    name: 'Test Agent',
    coverageLga: 'Kano Municipal',
    verified: false,
    totalRewardsEarned: 0,
    createdAt: new Date(),
    ...overrides,
  };
}

describe('AgentsService.verifyOtp', () => {
  let agentRepo: { findOne: jest.Mock; update: jest.Mock };
  let redis: { get: jest.Mock; set: jest.Mock; del: jest.Mock };
  let africasTalking: Partial<AfricasTalkingService>;
  let service: AgentsService;

  beforeEach(() => {
    agentRepo = { findOne: jest.fn(), update: jest.fn() };
    redis = { get: jest.fn(), set: jest.fn(), del: jest.fn() };
    africasTalking = { sendSms: jest.fn(), makeCall: jest.fn(), sendAirtime: jest.fn() };
    service = new AgentsService(
      agentRepo as unknown as Repository<Agent>,
      redis as never,
      africasTalking as AfricasTalkingService,
    );
  });

  it('returns no_pending when there is no OTP in Redis at all', async () => {
    redis.get.mockResolvedValueOnce(null);
    const result = await service.verifyOtp('+2340000009999', '123456');
    expect(result).toBe('no_pending');
    expect(redis.del).not.toHaveBeenCalled();
    expect(agentRepo.update).not.toHaveBeenCalled();
  });

  it('marks the agent verified on a correct code', async () => {
    redis.get.mockResolvedValueOnce('123456');
    agentRepo.findOne.mockResolvedValueOnce(makeAgent());
    const result = await service.verifyOtp('+2340000009999', '123456');
    expect(result).toBe('success');
    expect(agentRepo.update).toHaveBeenCalledWith('agent-1', { verified: true });
  });

  it('tolerates surrounding whitespace in the entered digits', async () => {
    redis.get.mockResolvedValueOnce('123456');
    agentRepo.findOne.mockResolvedValueOnce(makeAgent());
    const result = await service.verifyOtp('+2340000009999', '  123456  ');
    expect(result).toBe('success');
  });

  describe('brute-force resistance (single-shot consumption)', () => {
    it('returns failure on a wrong code, without ever verifying the agent', async () => {
      redis.get.mockResolvedValueOnce('123456');
      const result = await service.verifyOtp('+2340000009999', '000000');
      expect(result).toBe('failure');
      expect(agentRepo.update).not.toHaveBeenCalled();
    });

    it('deletes the Redis code on a WRONG attempt, not just a correct one', async () => {
      redis.get.mockResolvedValueOnce('123456');
      await service.verifyOtp('+2340000009999', 'wrong-guess');
      expect(redis.del).toHaveBeenCalledWith('agent:otp:+2340000009999');
    });

    it('a second guess after a wrong first attempt finds nothing left to guess against', async () => {
      // Simulates the real flow: first call's redis.get returns the code, second
      // call's redis.get returns null because the first attempt already deleted it.
      redis.get.mockResolvedValueOnce('123456').mockResolvedValueOnce(null);

      const first = await service.verifyOtp('+2340000009999', 'wrong-guess');
      const second = await service.verifyOtp('+2340000009999', '123456'); // even the *correct* code, too late

      expect(first).toBe('failure');
      expect(second).toBe('no_pending');
      expect(agentRepo.update).not.toHaveBeenCalled();
    });
  });
});
