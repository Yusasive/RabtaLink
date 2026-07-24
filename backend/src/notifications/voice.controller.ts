import { Body, Controller, Header, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle } from '@nestjs/throttler';
import { ActivityLogService } from '../activity/activity-log.service';
import { AtWebhookGuard } from '../common/guards/at-webhook.guard';
import {
  AGENT_OTP_FAILURE_VOICE,
  AGENT_OTP_SUCCESS_VOICE,
  AGENT_OTP_VOICE_PROMPT,
} from '../agents/agent-copy.constants';
import { AgentsService } from '../agents/agents.service';
import { MatchingService } from '../matching/matching.service';
import { recordIntroPromptText, recordIntroThanksText, taarufIntroText } from '../matching/taaruf-copy.constants';
import { PlaceTestCallDto } from './dto/place-test-call.dto';
import { VoiceService } from './voice.service';

// Africa's Talking Voice callback POSTs call metadata; field names for the base
// callback are well-established (sessionId/direction/callerNumber/destinationNumber).
// `dtmfDigits`/`recordingUrl` are what AT's docs describe but haven't been
// confirmed against a live call in this environment (see voice.service.ts note).
interface AtVoiceCallbackBody {
  sessionId: string;
  direction?: 'Inbound' | 'Outbound';
  callerNumber?: string;
  destinationNumber?: string;
  dtmfDigits?: string;
  recordingUrl?: string;
}

function resolveCallPhone(body: AtVoiceCallbackBody): string | undefined {
  if (body.direction === 'Inbound') return body.callerNumber ?? body.destinationNumber;
  return body.destinationNumber ?? body.callerNumber;
}

function appendToken(url: string, token: string): string {
  return `${url}${url.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`;
}

@Controller('voice')
export class VoiceController {
  constructor(
    private readonly voiceService: VoiceService,
    private readonly agentsService: AgentsService,
    private readonly matchingService: MatchingService,
    private readonly config: ConfigService,
    private readonly activityLog: ActivityLogService,
  ) {}

  /** M0-only manual trigger to prove the outbound Voice call round-trip against the AT sandbox. */
  @Post('test-call')
  testCall(@Body() dto: PlaceTestCallDto) {
    return this.voiceService.placeCall(dto.to);
  }

  @Post('callback')
  @HttpCode(200)
  @Header('Content-Type', 'application/xml')
  @UseGuards(AtWebhookGuard)
  @SkipThrottle()
  async callback(@Body() body: AtVoiceCallbackBody): Promise<string> {
    const phone = resolveCallPhone(body);
    if (phone) {
      const conference = await this.matchingService.getConferenceMarker(phone);
      if (conference) {
        this.activityLog.record({
          channel: 'voice',
          direction: 'inbound',
          summary: `Voice call connected ← ${phone} (Ta'aruf conference match-${conference.matchId})`,
          phoneNumber: phone,
        });
        return this.voiceService.taarufConferenceXml(
          taarufIntroText(conference.guardianIncluded),
          `match-${conference.matchId}`,
        );
      }

      const recordIntro = await this.voiceService.getRecordIntroMarker(phone);
      if (recordIntro) {
        this.activityLog.record({
          channel: 'voice',
          direction: 'inbound',
          summary: `Voice call connected ← ${phone} (voice-intro recording)`,
          phoneNumber: phone,
        });
        const callbackUrl = appendToken(
          `${this.config.get<string>('publicBaseUrl')}/voice/record-intro-complete`,
          this.config.get<string>('atWebhookSecret') ?? '',
        );
        return this.voiceService.recordIntroPromptXml(recordIntroPromptText(recordIntro.language), callbackUrl);
      }

      if (await this.agentsService.hasPendingOtp(phone)) {
        this.activityLog.record({
          channel: 'voice',
          direction: 'inbound',
          summary: `Voice call connected ← ${phone} (Agent OTP verification)`,
          phoneNumber: phone,
        });
        const callbackUrl = appendToken(
          `${this.config.get<string>('publicBaseUrl')}/voice/agent-otp-digits`,
          this.config.get<string>('atWebhookSecret') ?? '',
        );
        return this.voiceService.agentOtpPromptXml(AGENT_OTP_VOICE_PROMPT, callbackUrl);
      }
    }
    return this.voiceService.greetingXml();
  }

  @Post('agent-otp-digits')
  @HttpCode(200)
  @Header('Content-Type', 'application/xml')
  @UseGuards(AtWebhookGuard)
  @SkipThrottle()
  async otpDigits(@Body() body: AtVoiceCallbackBody): Promise<string> {
    const phone = resolveCallPhone(body);
    const digits = body.dtmfDigits ?? '';
    const result = phone ? await this.agentsService.verifyOtp(phone, digits) : 'no_pending';
    this.activityLog.record({
      channel: 'voice',
      direction: 'inbound',
      summary: `Voice DTMF ← ${phone ?? 'unknown'}: OTP ${result}`,
      phoneNumber: phone,
    });
    return this.voiceService.agentOtpResultXml(
      result === 'success' ? AGENT_OTP_SUCCESS_VOICE : AGENT_OTP_FAILURE_VOICE,
    );
  }

  @Post('record-intro-complete')
  @HttpCode(200)
  @Header('Content-Type', 'application/xml')
  @UseGuards(AtWebhookGuard)
  @SkipThrottle()
  async recordIntroComplete(@Body() body: AtVoiceCallbackBody): Promise<string> {
    const phone = resolveCallPhone(body);
    const marker = phone ? await this.voiceService.getRecordIntroMarker(phone) : null;
    const language = marker?.language ?? 'ha';

    if (phone && body.recordingUrl) {
      await this.voiceService.saveVoiceIntro(phone, body.recordingUrl);
      this.activityLog.record({
        channel: 'voice',
        direction: 'inbound',
        summary: `Voice-intro recording saved ← ${phone}`,
        phoneNumber: phone,
      });
    }
    return this.voiceService.recordIntroThanksXml(recordIntroThanksText(language));
  }
}
