import { UnauthorizedException } from '@nestjs/common';
import { AfricasTalkingService } from '../africastalking/africastalking.service';
import { Agent } from '../database/entities/agent.entity';
import { AgentsService } from '../agents/agents.service';
import { AuthService } from './auth.service';

function makeAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: 'agent-1',
    phoneNumber: '+2340000009999',
    name: 'Test Agent',
    coverageLga: 'Kano Municipal',
    verified: true,
    totalRewardsEarned: 0,
    createdAt: new Date(),
    ...overrides,
  };
}

describe('AuthService.verifyOtp — regression test for the OTP brute-force fix', () => {
  let agentsService: { findByPhone: jest.Mock };
  let redis: { get: jest.Mock; set: jest.Mock; del: jest.Mock };
  let africasTalking: Partial<AfricasTalkingService>;
  let jwtService: { signAsync: jest.Mock };
  let service: AuthService;

  beforeEach(() => {
    agentsService = { findByPhone: jest.fn() };
    redis = { get: jest.fn(), set: jest.fn(), del: jest.fn() };
    africasTalking = { sendSms: jest.fn() };
    jwtService = { signAsync: jest.fn().mockResolvedValue('signed.jwt.token') };
    service = new AuthService(
      agentsService as unknown as AgentsService,
      africasTalking as AfricasTalkingService,
      redis as never,
      jwtService as never,
    );
  });

  it('issues a token on a correct code for a verified agent', async () => {
    redis.get.mockResolvedValueOnce('482910');
    agentsService.findByPhone.mockResolvedValueOnce(makeAgent());

    const { accessToken } = await service.verifyOtp('+2340000009999', '482910');
    expect(accessToken).toBe('signed.jwt.token');
  });

  it('deletes the Redis code on a WRONG guess (this is the bug that was fixed)', async () => {
    redis.get.mockResolvedValueOnce('482910');
    await expect(service.verifyOtp('+2340000009999', '000000')).rejects.toThrow(UnauthorizedException);
    expect(redis.del).toHaveBeenCalledWith('dashboard:login-otp:+2340000009999');
  });

  it('makes a second guess impossible after a first wrong one, even with the right code', async () => {
    // First call's redis.get returns the real code; second call's redis.get
    // returns null because the wrong first attempt already deleted it — this is
    // exactly the brute-force scenario the fix closes off.
    redis.get.mockResolvedValueOnce('482910').mockResolvedValueOnce(null);

    await expect(service.verifyOtp('+2340000009999', 'wrong-guess-1')).rejects.toThrow(UnauthorizedException);
    await expect(service.verifyOtp('+2340000009999', '482910')).rejects.toThrow(UnauthorizedException);
    expect(jwtService.signAsync).not.toHaveBeenCalled();
  });

  it('rejects when no OTP was ever requested', async () => {
    redis.get.mockResolvedValueOnce(null);
    await expect(service.verifyOtp('+2340000009999', '482910')).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a correct code if the agent is no longer verified', async () => {
    redis.get.mockResolvedValueOnce('482910');
    agentsService.findByPhone.mockResolvedValueOnce(makeAgent({ verified: false }));
    await expect(service.verifyOtp('+2340000009999', '482910')).rejects.toThrow(UnauthorizedException);
  });
});
