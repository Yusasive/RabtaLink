import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';

export type ActivityChannel = 'ussd' | 'sms' | 'voice' | 'airtime';
export type ActivityDirection = 'inbound' | 'outbound';

export interface ActivityEvent {
  id: string;
  channel: ActivityChannel;
  direction: ActivityDirection;
  summary: string;
  phoneNumber?: string;
  timestamp: string;
}

const MAX_EVENTS = 200;

/**
 * M9 demo-mode judge screen (PRD §4/§10): a single, global, in-memory feed of
 * every USSD/SMS/Voice/Airtime event, so the live activity screen can prove all
 * four API categories are firing without watching a feature-phone emulator.
 * Deliberately not a DB table — this is ephemeral demo/observability data, not
 * a domain entity, and TRD §3's schema has no place for it.
 */
@Injectable()
export class ActivityLogService {
  private events: ActivityEvent[] = [];

  record(event: Omit<ActivityEvent, 'id' | 'timestamp'>): void {
    this.events.unshift({ ...event, id: randomUUID(), timestamp: new Date().toISOString() });
    if (this.events.length > MAX_EVENTS) this.events.length = MAX_EVENTS;
  }

  getRecent(limit = 50): ActivityEvent[] {
    return this.events.slice(0, limit);
  }

  getCountsByChannel(): Record<ActivityChannel, number> {
    const counts: Record<ActivityChannel, number> = { ussd: 0, sms: 0, voice: 0, airtime: 0 };
    for (const event of this.events) counts[event.channel]++;
    return counts;
  }
}
