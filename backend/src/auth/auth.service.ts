import { randomInt } from 'node:crypto';
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AfricasTalkingService } from '../africastalking/africastalking.service';
import { AgentsService } from '../agents/agents.service';
import { RedisService } from '../redis/redis.service';

const OTP_TTL_SECONDS = 5 * 60;

function loginOtpKey(phoneNumber: string): string {
  return `dashboard:login-otp:${phoneNumber}`;
}

export interface AgentJwtPayload {
  sub: string;
  phoneNumber: string;
}

/**
 * Dashboard login (TRD §2: JWT-based, internal-only). Reuses the same
 * phone+OTP pattern as end-user auth (no passwords anywhere in this product),
 * but against a separate Redis namespace from M3's agent-verification OTP —
 * this is a *login* code, not a one-time verification of the phone itself.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly agentsService: AgentsService,
    private readonly africasTalking: AfricasTalkingService,
    private readonly redis: RedisService,
    private readonly jwtService: JwtService,
  ) {}

  async requestOtp(phoneNumber: string): Promise<void> {
    const agent = await this.agentsService.findByPhone(phoneNumber);
    if (!agent || !agent.verified) {
      throw new UnauthorizedException('No verified agent found for this phone number');
    }

    const code = String(randomInt(100000, 999999));
    await this.redis.set(loginOtpKey(phoneNumber), code, OTP_TTL_SECONDS);

    this.africasTalking
      .sendSms(phoneNumber, `RabtaLink: Lambar shiga dashboard: ${code}. Kada ka fada wa kowa.`)
      .catch((err: unknown) => this.logger.error(`Dashboard login OTP SMS failed for ${phoneNumber}`, err));
  }

  /** Single-shot, same as M3's agent-verification OTP: consumed on any attempt, right or wrong. */
  async verifyOtp(phoneNumber: string, code: string): Promise<{ accessToken: string }> {
    const expected = await this.redis.get(loginOtpKey(phoneNumber));
    await this.redis.del(loginOtpKey(phoneNumber));
    if (!expected || expected !== code.trim()) {
      throw new UnauthorizedException('Invalid or expired code');
    }

    const agent = await this.agentsService.findByPhone(phoneNumber);
    if (!agent || !agent.verified) {
      throw new UnauthorizedException('No verified agent found for this phone number');
    }

    const payload: AgentJwtPayload = { sub: agent.id, phoneNumber: agent.phoneNumber };
    const accessToken = await this.jwtService.signAsync(payload);
    return { accessToken };
  }
}
