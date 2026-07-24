import { randomInt } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AfricasTalkingService } from '../africastalking/africastalking.service';
import { Agent } from '../database/entities/agent.entity';
import { User } from '../database/entities/user.entity';
import { RedisService } from '../redis/redis.service';
import { agentMatchingRegistrantSms, agentOtpSms } from './agent-copy.constants';

const OTP_TTL_SECONDS = 10 * 60;

function otpKey(phoneNumber: string): string {
  return `agent:otp:${phoneNumber}`;
}

export type OtpVerifyResult = 'success' | 'failure' | 'no_pending';

@Injectable()
export class AgentsService {
  private readonly logger = new Logger(AgentsService.name);

  constructor(
    @InjectRepository(Agent) private readonly agentRepo: Repository<Agent>,
    private readonly redis: RedisService,
    private readonly africasTalking: AfricasTalkingService,
  ) {}

  async findByPhone(phoneNumber: string): Promise<Agent | null> {
    return this.agentRepo.findOne({ where: { phoneNumber } });
  }

  async findById(id: string): Promise<Agent | null> {
    return this.agentRepo.findOne({ where: { id } });
  }

  /** Upserts by phone_number (unique per TRD §3): re-registering refreshes name/LGA. */
  async registerOrUpdate(phoneNumber: string, name: string, coverageLga: string): Promise<Agent> {
    const existing = await this.agentRepo.findOne({ where: { phoneNumber } });
    if (existing) {
      await this.agentRepo.update(existing.id, { name, coverageLga });
      return { ...existing, name, coverageLga };
    }
    return this.agentRepo.save(this.agentRepo.create({ phoneNumber, name, coverageLga, verified: false }));
  }

  /**
   * Fires the OTP SMS + outbound verification call, fire-and-forget (never blocks
   * the USSD response). The OTP code itself is written to Redis synchronously so a
   * near-immediate call answer can already find it.
   */
  async startVerification(agent: Agent): Promise<void> {
    const code = String(randomInt(100000, 999999));
    await this.redis.set(otpKey(agent.phoneNumber), code, OTP_TTL_SECONDS);

    this.africasTalking
      .sendSms(agent.phoneNumber, agentOtpSms(code))
      .catch((err: unknown) => this.logger.error(`Agent OTP SMS failed for ${agent.phoneNumber}`, err));

    this.africasTalking
      .makeCall(agent.phoneNumber)
      .catch((err: unknown) => this.logger.error(`Agent OTP call failed for ${agent.phoneNumber}`, err));
  }

  async hasPendingOtp(phoneNumber: string): Promise<boolean> {
    return (await this.redis.get(otpKey(phoneNumber))) !== null;
  }

  /** Single-attempt verification: the OTP is consumed (deleted) whether it matches or not. */
  async verifyOtp(phoneNumber: string, enteredDigits: string): Promise<OtpVerifyResult> {
    const expected = await this.redis.get(otpKey(phoneNumber));
    if (!expected) return 'no_pending';

    await this.redis.del(otpKey(phoneNumber));
    if (enteredDigits.trim() !== expected) return 'failure';

    const agent = await this.agentRepo.findOne({ where: { phoneNumber } });
    if (!agent) return 'no_pending';

    await this.agentRepo.update(agent.id, { verified: true });
    this.logger.log(`Agent ${agent.id} (${phoneNumber}) verified via Voice OTP`);
    return 'success';
  }

  /** PRD §5.3: agents get notified of new registrants matching their coverage LGA. */
  notifyMatchingAgents(user: User): void {
    if (!user.lga) return;
    this.agentRepo
      .find({ where: { coverageLga: user.lga, verified: true } })
      .then((agents) => {
        const message = agentMatchingRegistrantSms(user.intentType);
        for (const agent of agents) {
          this.africasTalking
            .sendSms(agent.phoneNumber, message)
            .catch((err: unknown) => this.logger.error(`Agent notify SMS failed for ${agent.phoneNumber}`, err));
        }
      })
      .catch((err: unknown) => this.logger.error(`Failed to look up agents for LGA ${user.lga}`, err));
  }
}
