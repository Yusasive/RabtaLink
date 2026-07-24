import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ActivityLogService } from '../activity/activity-log.service';
import { AtWebhookGuard } from '../common/guards/at-webhook.guard';
import { ConsentService } from '../consent/consent.service';
import { MatchingService } from '../matching/matching.service';
import { SendTestSmsDto } from './dto/send-test-sms.dto';
import { SmsService } from './sms.service';

// Africa's Talking inbound SMS webhook POSTs application/x-www-form-urlencoded:
// from, to, text, id, linkId, date.
interface AtInboundSmsBody {
  from: string;
  to: string;
  text: string;
  linkId?: string;
  date?: string;
}

@Controller('sms')
export class SmsController {
  constructor(
    private readonly smsService: SmsService,
    private readonly consentService: ConsentService,
    private readonly matchingService: MatchingService,
    private readonly activityLog: ActivityLogService,
  ) {}

  @Post('inbound')
  @HttpCode(200)
  @UseGuards(AtWebhookGuard)
  @SkipThrottle()
  async handleInbound(@Body() body: AtInboundSmsBody): Promise<{ received: true }> {
    this.smsService.handleInbound(body);
    this.activityLog.record({
      channel: 'sms',
      direction: 'inbound',
      summary: `SMS ← ${body.from}: "${body.text}"`,
      phoneNumber: body.from,
    });
    // M2: guardian YES/NO consent replies. M4: matched-user 1/2 accept/decline replies.
    // Distinct keyword spaces (YES/NO vs 1/2), so both can safely inspect every inbound SMS.
    await this.consentService.handleInboundReply(body.from, body.text);
    await this.matchingService.handleInboundReply(body.from, body.text);
    return { received: true };
  }

  /**
   * M0-only manual trigger to prove the outbound SMS round-trip against the AT
   * sandbox. Real sends are triggered by product events from M1 onward, not this route.
   */
  @Post('test-send')
  testSend(@Body() dto: SendTestSmsDto) {
    return this.smsService.send(dto.to, dto.message);
  }
}
