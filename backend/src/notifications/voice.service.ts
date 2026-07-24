import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AfricasTalkingService } from '../africastalking/africastalking.service';
import { Language, User } from '../database/entities/user.entity';
import { RedisService } from '../redis/redis.service';

const RECORD_INTRO_TTL_SECONDS = 10 * 60;

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function recordIntroMarkerKey(phoneNumber: string): string {
  return `voice:record-intro:${phoneNumber}`;
}

@Injectable()
export class VoiceService {
  private readonly logger = new Logger(VoiceService.name);

  constructor(
    private readonly africasTalking: AfricasTalkingService,
    private readonly redis: RedisService,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  async markRecordIntroPending(phoneNumber: string, language: Language): Promise<void> {
    await this.redis.set(recordIntroMarkerKey(phoneNumber), JSON.stringify({ language }), RECORD_INTRO_TTL_SECONDS);
  }

  async getRecordIntroMarker(phoneNumber: string): Promise<{ language: Language } | null> {
    const raw = await this.redis.get(recordIntroMarkerKey(phoneNumber));
    return raw ? (JSON.parse(raw) as { language: Language }) : null;
  }

  /**
   * TRD §6 NFR calls for voice clips stored as signed/expiring URLs only. This
   * stores whatever URL AT's recording callback provides as-is — wrapping it in
   * our own signed/expiring proxy is a known gap, not built here, since AT's
   * actual recording-storage/URL behavior can't be verified in this environment.
   */
  async saveVoiceIntro(phoneNumber: string, url: string): Promise<void> {
    await this.userRepo.update({ phoneNumber }, { voiceIntroUrl: url });
    await this.redis.del(recordIntroMarkerKey(phoneNumber));
  }

  placeCall(to: string) {
    return this.africasTalking.makeCall(to);
  }

  /**
   * M0 stub greeting returned to AT's Voice callback when a call connects, just to
   * prove the outbound-call + callback round-trip. Real IVR/Ta'aruf flows land in M6.
   */
  greetingXml(): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="woman">Barka da zuwa RabtaLink. This is a development test call.</Say>
</Response>`;
  }

  /**
   * M3: played when an agent's verification call connects. `GetDigits` schema
   * (finishOnKey/numDigits/timeout/callbackUrl, single say|play child) verified
   * against the AT SDK's own ActionBuilder (node_modules/africastalking/lib/actionbuilder.js) —
   * the field names AT's callback POSTs back on digit entry are not independently
   * confirmed against a live sandbox call (same open item TRD §9 already flags for Voice).
   */
  agentOtpPromptXml(promptText: string, callbackUrl: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <GetDigits timeout="15" finishOnKey="#" callbackUrl="${escapeXml(callbackUrl)}">
    <Say voice="woman">${escapeXml(promptText)}</Say>
  </GetDigits>
</Response>`;
  }

  agentOtpResultXml(resultText: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="woman">${escapeXml(resultText)}</Say>
</Response>`;
  }

  /**
   * M6/TRD §9: system intro + Conference bridge for a Ta'aruf call leg. The AT
   * SDK's own ActionBuilder.conference() takes no room-name parameter at all, so
   * this room-as-text-content shape is written per TRD §9's own decision text, not
   * a verified schema — TRD §9 explicitly flags this as an open item to confirm
   * against the live sandbox/API reference, which this environment cannot reach
   * (M0 already found voice.sandbox.africastalking.com unresolvable).
   */
  taarufConferenceXml(introText: string, conferenceRoom: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="woman">${escapeXml(introText)}</Say>
  <Conference>${escapeXml(conferenceRoom)}</Conference>
</Response>`;
  }

  /**
   * M6: voice-intro recording (TRD §4.3). `Record` schema (finishOnKey/maxLength/
   * timeout/callbackUrl, single say|play child) verified against the AT SDK's
   * ActionBuilder, same as GetDigits — the callback's recording-URL field name is
   * a best-effort guess (`recordingUrl`), unverified for the same reason as above.
   */
  recordIntroPromptXml(promptText: string, callbackUrl: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Record finishOnKey="#" maxLength="60" timeout="10" callbackUrl="${escapeXml(callbackUrl)}">
    <Say voice="woman">${escapeXml(promptText)}</Say>
  </Record>
</Response>`;
  }

  recordIntroThanksXml(thanksText: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="woman">${escapeXml(thanksText)}</Say>
</Response>`;
  }
}
