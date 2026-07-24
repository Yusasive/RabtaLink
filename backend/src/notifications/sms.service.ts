import { Injectable, Logger } from '@nestjs/common';
import { AfricasTalkingService } from '../africastalking/africastalking.service';

export interface InboundSms {
  from: string;
  to: string;
  text: string;
  linkId?: string;
  date?: string;
}

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(private readonly africasTalking: AfricasTalkingService) {}

  send(to: string, message: string) {
    return this.africasTalking.sendSms(to, message);
  }

  /**
   * M0 stub: logs inbound SMS so the AT inbound-SMS webhook round-trip is provable.
   * Guardian YES/NO parsing against `guardians.phone_number` lands in M2.
   */
  handleInbound(sms: InboundSms): void {
    this.logger.log(`Inbound SMS from ${sms.from}: "${sms.text}"`);
  }
}
