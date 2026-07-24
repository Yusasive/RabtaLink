import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { UssdSessionRecord } from './ussd-flow.types';

const SESSION_TTL_SECONDS = 180; // AT USSD sessions are short-lived; matches TRD §4.1 latency note
const RESUME_TTL_SECONDS = 24 * 60 * 60; // PRD §5.1: registrant can resume after a dropped session

function sessionKey(sessionId: string): string {
  return `ussd:session:${sessionId}`;
}

function resumeKey(phoneNumber: string): string {
  return `ussd:resume:${phoneNumber}`;
}

@Injectable()
export class UssdSessionStore {
  constructor(private readonly redis: RedisService) {}

  async getSession(sessionId: string): Promise<UssdSessionRecord | null> {
    const raw = await this.redis.get(sessionKey(sessionId));
    return raw ? (JSON.parse(raw) as UssdSessionRecord) : null;
  }

  async saveSession(sessionId: string, record: UssdSessionRecord): Promise<void> {
    await this.redis.set(sessionKey(sessionId), JSON.stringify(record), SESSION_TTL_SECONDS);
  }

  async clearSession(sessionId: string): Promise<void> {
    await this.redis.del(sessionKey(sessionId));
  }

  async getResume(phoneNumber: string): Promise<UssdSessionRecord | null> {
    const raw = await this.redis.get(resumeKey(phoneNumber));
    return raw ? (JSON.parse(raw) as UssdSessionRecord) : null;
  }

  async saveResume(phoneNumber: string, record: UssdSessionRecord): Promise<void> {
    await this.redis.set(resumeKey(phoneNumber), JSON.stringify(record), RESUME_TTL_SECONDS);
  }

  async clearResume(phoneNumber: string): Promise<void> {
    await this.redis.del(resumeKey(phoneNumber));
  }
}
