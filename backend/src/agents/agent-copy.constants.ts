import { IntentType } from '../database/entities/user.entity';

// Agent-facing SMS/Voice copy is Hausa-only: the `agents` table (TRD §3) has no
// language column, unlike `users`. Agent personas (PRD §3.3) are drawn from an
// existing Hausa-speaking matchmaker community, so this is a deliberate scope
// simplification, not an oversight — revisit if non-Hausa-speaking agents onboard.
export function agentOtpSms(code: string): string {
  return `RabtaLink: Lambar tabbatar da Wakili: ${code}. Kada ka fada wa kowa.`;
}

// UI-UX §5 gives this verbatim as the Rabta Agent verification call script.
export const AGENT_OTP_VOICE_PROMPT =
  'Barka da zuwa RabtaLink Wakili Verification. Don Allah shigar da lambar da aka aiko maka ta SMS, sannan danna #.';

export const AGENT_OTP_SUCCESS_VOICE = 'Na gode, an tabbatar da kai a matsayin Wakili.';

export const AGENT_OTP_FAILURE_VOICE = 'Lambar da ka shigar ba daidai ba ce. Ka sake gwadawa daga menu.';

const INTENT_LABEL_HA: Record<IntentType, string> = {
  marriage: 'aure',
  friendship: 'aboki/abokiya',
  professional: "hulda ta sana'a",
};

export function agentMatchingRegistrantSms(intentType: IntentType): string {
  return `RabtaLink: Sabon dan/'yar rijista mai neman ${INTENT_LABEL_HA[intentType]} a yankinka. Bincika don karin bayani.`;
}
