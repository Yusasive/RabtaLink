import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ActivityLogService } from '../activity/activity-log.service';

export interface SmsSendResult {
  [key: string]: unknown;
}

export interface VoiceCallResult {
  [key: string]: unknown;
}

export interface AirtimeRecipient {
  phoneNumber: string;
  amount: number;
  currencyCode: string; // ISO 4217, e.g. "NGN"
}

export interface AirtimeSendResult {
  [key: string]: unknown;
}

interface AfricasTalkingClient {
  SMS: {
    send(params: { to: string | string[]; message: string }): Promise<SmsSendResult>;
  };
  VOICE: {
    call(params: { callFrom: string; callTo: string | string[] }): Promise<VoiceCallResult>;
  };
  AIRTIME: {
    send(params: { recipients: AirtimeRecipient[] }): Promise<AirtimeSendResult>;
  };
}

type AfricasTalkingFactory = (options: { apiKey: string; username: string }) => AfricasTalkingClient;

// africastalking ships no TS types; cast the require() result to the slice of the
// client surface (SMS/VOICE/AIRTIME) this service actually uses.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const AfricasTalkingSdk = require('africastalking') as AfricasTalkingFactory;

@Injectable()
export class AfricasTalkingService implements OnModuleInit {
  private readonly logger = new Logger(AfricasTalkingService.name);
  private client!: AfricasTalkingClient;

  constructor(
    private readonly config: ConfigService,
    private readonly activityLog: ActivityLogService,
  ) {}

  onModuleInit(): void {
    this.client = AfricasTalkingSdk({
      apiKey: this.config.get<string>('africastalking.apiKey') ?? '',
      username: this.config.get<string>('africastalking.username') ?? 'sandbox',
    });
  }

  sendSms(to: string | string[], message: string): Promise<SmsSendResult> {
    const target = Array.isArray(to) ? to.join(',') : to;
    this.logger.log(`Sending SMS to ${target}`);
    this.activityLog.record({
      channel: 'sms',
      direction: 'outbound',
      summary: `SMS → ${target}: "${message.slice(0, 60)}${message.length > 60 ? '…' : ''}"`,
      phoneNumber: target,
    });
    return this.client.SMS.send({ to, message });
  }

  makeCall(callTo: string | string[]): Promise<VoiceCallResult> {
    const callFrom = this.config.get<string>('africastalking.voiceNumber') ?? '';
    const target = Array.isArray(callTo) ? callTo.join(',') : callTo;
    this.logger.log(`Placing call from ${callFrom} to ${target}`);
    this.activityLog.record({
      channel: 'voice',
      direction: 'outbound',
      summary: `Voice call placed → ${target}`,
      phoneNumber: target,
    });
    return this.client.VOICE.call({ callFrom, callTo });
  }

  sendAirtime(recipients: AirtimeRecipient[]): Promise<AirtimeSendResult> {
    const target = recipients.map((r) => r.phoneNumber).join(',');
    this.logger.log(`Sending airtime to ${target}`);
    this.activityLog.record({
      channel: 'airtime',
      direction: 'outbound',
      summary: `Airtime ${recipients.map((r) => `${r.currencyCode} ${r.amount}`).join(', ')} → ${target}`,
      phoneNumber: target,
    });
    return this.client.AIRTIME.send({ recipients });
  }
}
